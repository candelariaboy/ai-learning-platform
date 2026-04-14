from __future__ import annotations

from collections import defaultdict
from urllib.parse import quote_plus

from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy.orm import Session

from app.models import LearningProgress, PracticeDimension, RecommendationAction, Repo, User

ADOPTED_ACTIONS = {"clicked", "accepted", "completed", "started"}
FALLBACK_ACTIONS = {"shown"}
COURSE_URL_HINTS = ("freecodecamp.org", "learn.microsoft.com", "skillsforall.com", "coursera.org", "udemy.com")
ACTION_WEIGHTS = {
    "shown": 0.2,
    "clicked": 0.8,
    "accepted": 1.0,
    "started": 1.2,
    "completed": 1.5,
    "rated": 0.4,
    "rejected": -0.6,
}
PERSONALIZATION_ACTION_WEIGHTS = {
    "shown": 0.0,
    "clicked": 0.4,
    "accepted": 1.2,
    "started": 1.6,
    "completed": 2.2,
    "rated": 0.6,
    "rejected": -1.8,
}


def _normalize_dimension_label(label: str | None) -> str | None:
    if not label:
        return None
    text = label.strip().lower()
    if "front" in text:
        return "frontend"
    if "back" in text or "api" in text:
        return "backend"
    if "data" in text or "intelligence" in text or "machine" in text:
        return "data"
    if "devops" in text or "system" in text or "ops" in text:
        return "devops"
    return None


def _build_skill_vector(rows: list[PracticeDimension]) -> list[float]:
    values = {"frontend": 0.0, "backend": 0.0, "data": 0.0, "devops": 0.0}
    for row in rows:
        key = _normalize_dimension_label(row.label)
        if key is None:
            continue
        values[key] = float(max(0, min(100, row.confidence or 0)))
    return [values["frontend"], values["backend"], values["data"], values["devops"]]


def _is_zero_vector(vector: list[float]) -> bool:
    return all(value == 0 for value in vector)


def _build_behavior_vector(
    recommendation_actions: list[RecommendationAction],
    learning_rows: list[LearningProgress],
) -> list[float]:
    dimension_scores = {"frontend": 0.0, "backend": 0.0, "data": 0.0, "devops": 0.0}
    rating_values: list[float] = []
    adopted_count = 0
    completed_count = 0
    feedback_count = 0

    for action in recommendation_actions:
        weight = float(ACTION_WEIGHTS.get((action.action or "").lower(), 0.0))
        if action.action in ADOPTED_ACTIONS:
            adopted_count += 1
        if (action.action or "").lower() == "completed":
            completed_count += 1
        if (action.feedback or "").strip():
            feedback_count += 1
        if action.rating is not None:
            rating_values.append(float(max(1, min(5, int(action.rating)))))
            weight += float(action.rating) / 5.0
        key = _normalize_dimension_label(action.dimension_key)
        if key:
            dimension_scores[key] += weight

    action_total = max(1, len(recommendation_actions))
    for key in list(dimension_scores.keys()):
        # Saturating transform so very active users do not dominate similarity unfairly.
        normalized = max(0.0, min(100.0, dimension_scores[key] * 12.0))
        dimension_scores[key] = normalized

    adopted_rate = max(0.0, min(100.0, (adopted_count / action_total) * 100.0))
    completion_signal = max(0.0, min(100.0, (completed_count / action_total) * 100.0))
    feedback_density = max(0.0, min(100.0, (feedback_count / action_total) * 100.0))
    avg_rating_score = (sum(rating_values) / len(rating_values) * 20.0) if rating_values else 0.0

    done_steps = sum(1 for row in learning_rows if (row.status or "").lower() == "done")
    learning_completion = max(0.0, min(100.0, (done_steps / max(1, len(learning_rows))) * 100.0))

    return [
        dimension_scores["frontend"],
        dimension_scores["backend"],
        dimension_scores["data"],
        dimension_scores["devops"],
        adopted_rate,
        completion_signal,
        feedback_density,
        avg_rating_score,
        learning_completion,
    ]


def _collect_peer_actions(db: Session, peer_ids: list[int], actions: set[str]) -> list[RecommendationAction]:
    if not peer_ids:
        return []
    return (
        db.query(RecommendationAction)
        .filter(
            RecommendationAction.user_id.in_(peer_ids),
            RecommendationAction.action.in_(list(actions)),
        )
        .all()
    )


def _target_feedback_profile(actions: list[RecommendationAction]) -> dict[tuple[str, str], dict]:
    grouped: dict[tuple[str, str], dict] = {}
    for action in actions:
        title = (action.module_title or "").strip()
        url = (action.module_url or "").strip()
        if not title or not url:
            continue
        key = (title.lower(), url.lower())
        payload = grouped.setdefault(key, {"score": 0.0, "rejects": 0, "seen": 0})
        action_key = (action.action or "").strip().lower()
        payload["score"] += float(PERSONALIZATION_ACTION_WEIGHTS.get(action_key, 0.0))
        payload["seen"] += 1
        if action_key == "rejected":
            payload["rejects"] += 1
        if action.rating is not None:
            rating = max(1, min(5, int(action.rating)))
            payload["score"] += (float(rating) - 3.0) * 0.7
        feedback_text = (action.feedback or "").strip().lower()
        if feedback_text:
            if any(term in feedback_text for term in {"irrelevant", "not helpful", "already know", "duplicate"}):
                payload["score"] -= 0.6
            if any(term in feedback_text for term in {"helpful", "useful", "relevant", "good"}):
                payload["score"] += 0.4
    return grouped


def _is_course_module_url(url: str | None) -> bool:
    if not url:
        return False
    lower = url.lower()
    return any(hint in lower for hint in COURSE_URL_HINTS)


def _collect_peer_repo_recommendations(db: Session, peer_ids: list[int], score_by_peer: dict[int, float]) -> list[dict]:
    if not peer_ids:
        return []

    repos = (
        db.query(Repo)
        .filter(Repo.user_id.in_(peer_ids), Repo.commit_count > 0)
        .all()
    )

    grouped: dict[str, dict] = {}
    for repo in repos:
        language = (repo.language or "Project").strip()
        key = language.lower()
        if key not in grouped:
            grouped[key] = {
                "language": language,
                "peer_ids": set(),
                "score": 0.0,
                "sample_repo": (repo.name or "").strip() or "peer project",
            }
        grouped[key]["peer_ids"].add(repo.user_id)

    for payload in grouped.values():
        payload["score"] = sum(score_by_peer.get(peer_id, 0.0) for peer_id in payload["peer_ids"])

    ranked = sorted(
        grouped.values(),
        key=lambda item: (len(item["peer_ids"]), item["score"]),
        reverse=True,
    )

    results: list[dict] = []
    for item in ranked[:4]:
        lang = item["language"]
        query = quote_plus(f"{lang} devpath portfolio project")
        results.append(
            {
                "title": f"Peer Project Track: {lang}",
                "description": f"Similar peers actively build {lang} projects (example: {item['sample_repo']}).",
                "module_url": f"https://github.com/search?q={query}&type=repositories",
                "dimension_key": _normalize_dimension_label(lang),
                "similar_students_count": len(item["peer_ids"]),
            }
        )
    return results


def get_peer_recommendations(db: Session, username: str) -> list[dict]:
    target_user = db.query(User).filter(User.username == username).one_or_none()
    if not target_user:
        return []

    users = db.query(User).all()
    if len(users) <= 1:
        return []

    dimensions = db.query(PracticeDimension).all()
    by_user: dict[int, list[PracticeDimension]] = defaultdict(list)
    for row in dimensions:
        by_user[row.user_id].append(row)

    action_rows = db.query(RecommendationAction).all()
    actions_by_user: dict[int, list[RecommendationAction]] = defaultdict(list)
    for row in action_rows:
        actions_by_user[row.user_id].append(row)

    learning_rows = db.query(LearningProgress).all()
    learning_by_user: dict[int, list[LearningProgress]] = defaultdict(list)
    for row in learning_rows:
        learning_by_user[row.user_id].append(row)

    vectors: list[list[float]] = []
    user_ids: list[int] = []
    for user in users:
        skill_vector = _build_skill_vector(by_user.get(user.id, []))
        behavior_vector = _build_behavior_vector(
            actions_by_user.get(user.id, []),
            learning_by_user.get(user.id, []),
        )
        vector = skill_vector + behavior_vector
        vectors.append(vector)
        user_ids.append(user.id)

    try:
        target_index = user_ids.index(target_user.id)
    except ValueError:
        return []

    target_vector = vectors[target_index]
    if _is_zero_vector(target_vector):
        return []

    similarities = cosine_similarity([target_vector], vectors)[0]
    ranked = sorted(
        [
            (user_ids[idx], float(score))
            for idx, score in enumerate(similarities)
            if user_ids[idx] != target_user.id and float(score) > 0
        ],
        key=lambda item: item[1],
        reverse=True,
    )[:3]
    if not ranked:
        return []

    peer_ids = [user_id for user_id, _ in ranked]
    score_by_peer = {user_id: score for user_id, score in ranked}
    target_actions = (
        db.query(RecommendationAction)
        .filter(RecommendationAction.user_id == target_user.id)
        .all()
    )
    feedback_profile = _target_feedback_profile(target_actions)

    actions = _collect_peer_actions(db, peer_ids, ADOPTED_ACTIONS)
    if not actions:
        # Fallback for sparse datasets: use peer modules that were at least shown.
        actions = _collect_peer_actions(db, peer_ids, FALLBACK_ACTIONS)

    grouped: dict[tuple[str, str], dict] = {}
    for action in actions:
        title = (action.module_title or "").strip()
        url = (action.module_url or "").strip()
        if not title or not url:
            continue
        key = (title.lower(), url.lower())
        if key not in grouped:
            grouped[key] = {
                "title": title,
                "description": f"Matched peers interacted with this module for {action.dimension_key or 'core'} skill growth.",
                "module_url": url,
                "dimension_key": action.dimension_key,
                "peer_ids": set(),
                "similarity_score": 0.0,
            }
        grouped[key]["peer_ids"].add(action.user_id)

    for payload in grouped.values():
        payload["similarity_score"] = sum(score_by_peer.get(peer_id, 0.0) for peer_id in payload["peer_ids"])

    ranked_modules = sorted(
        grouped.values(),
        key=lambda item: (len(item["peer_ids"]), item["similarity_score"]),
        reverse=True,
    )

    module_results = []
    for item in ranked_modules[:6]:
        key = (
            (item.get("title") or "").strip().lower(),
            (item.get("module_url") or "").strip().lower(),
        )
        feedback_meta = feedback_profile.get(key, {"score": 0.0, "rejects": 0, "seen": 0})
        # Hard suppress repeatedly rejected modules unless there is very strong peer support.
        if int(feedback_meta.get("rejects", 0)) >= 2 and float(feedback_meta.get("score", 0.0)) < 0.0:
            continue
        module_results.append(
            {
                "title": item["title"],
                "description": item["description"],
                "module_url": item["module_url"],
                "dimension_key": item["dimension_key"],
                "similar_students_count": len(item["peer_ids"]),
                "_feedback_score": float(feedback_meta.get("score", 0.0)),
                "_peer_rank_score": float(item.get("similarity_score", 0.0)),
            }
        )

    module_results = sorted(
        module_results,
        key=lambda item: (
            item.get("_feedback_score", 0.0),
            item.get("similar_students_count", 0),
            item.get("_peer_rank_score", 0.0),
        ),
        reverse=True,
    )
    for item in module_results:
        item.pop("_feedback_score", None)
        item.pop("_peer_rank_score", None)

    repo_results = _collect_peer_repo_recommendations(db, peer_ids, score_by_peer)
    if not module_results:
        return repo_results[:6]

    course_like_count = sum(1 for item in module_results if _is_course_module_url(item.get("module_url")))
    if course_like_count == len(module_results):
        # If modules are purely course links, prioritize repo-style peer signals first.
        return (repo_results + module_results)[:6]

    return (module_results + repo_results)[:6]
