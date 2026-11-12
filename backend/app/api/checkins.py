from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.db import get_db
from app.models import Astronaut
from app.checkin_models import DailyCheckIn, CognitiveAssessment

from app.schemas import (
    DailyCheckInCreate,
    DailyCheckInOut,
    CognitiveAssessmentCreate,
    CognitiveAssessmentOut,
)


router = APIRouter()


# ==================================================
# DAILY CHECK-IN ENDPOINTS
# ==================================================

@router.post(
    "/checkins",
    response_model=DailyCheckInOut,
    status_code=201,
)
def create_checkin(
    payload: DailyCheckInCreate,
    db: Session = Depends(get_db),
):
    astronaut = db.get(Astronaut, payload.astronaut_id)

    if not astronaut:
        raise HTTPException(
            status_code=404,
            detail="Astronaut not found.",
        )

    existing = db.scalar(
        select(DailyCheckIn).where(
            DailyCheckIn.astronaut_id == payload.astronaut_id,
            DailyCheckIn.checkin_date == payload.checkin_date,
        )
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="A daily check-in already exists for this astronaut and date.",
        )

    checkin = DailyCheckIn(
        astronaut_id=payload.astronaut_id,
        checkin_date=payload.checkin_date,
        mood_score=payload.mood_score,
        stress_score=payload.stress_score,
        fatigue_score=payload.fatigue_score,
        sleep_quality_score=payload.sleep_quality_score,
        notes=payload.notes,
        simulated=payload.simulated,
        metadata_json=payload.metadata,
    )

    db.add(checkin)

    try:
        db.commit()
        db.refresh(checkin)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="A daily check-in already exists for this astronaut and date.",
        )

    return checkin


@router.get(
    "/astronauts/{astronaut_id}/checkins",
    response_model=list[DailyCheckInOut],
)
def get_checkin_history(
    astronaut_id: str,
    limit: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    astronaut = db.get(Astronaut, astronaut_id)

    if not astronaut:
        raise HTTPException(
            status_code=404,
            detail="Astronaut not found.",
        )

    records = db.scalars(
        select(DailyCheckIn)
        .where(
            DailyCheckIn.astronaut_id == astronaut_id
        )
        .order_by(desc(DailyCheckIn.checkin_date))
        .limit(limit)
    ).all()

    return records


@router.get(
    "/astronauts/{astronaut_id}/checkins/latest",
    response_model=DailyCheckInOut,
)
def get_latest_checkin(
    astronaut_id: str,
    db: Session = Depends(get_db),
):
    astronaut = db.get(Astronaut, astronaut_id)

    if not astronaut:
        raise HTTPException(
            status_code=404,
            detail="Astronaut not found.",
        )

    record = db.scalar(
        select(DailyCheckIn)
        .where(
            DailyCheckIn.astronaut_id == astronaut_id
        )
        .order_by(desc(DailyCheckIn.checkin_date))
        .limit(1)
    )

    if not record:
        raise HTTPException(
            status_code=404,
            detail="No check-in records found.",
        )

    return record


# ==================================================
# COGNITIVE ASSESSMENT ENDPOINTS
# ==================================================

@router.post(
    "/cognitive-assessments",
    response_model=CognitiveAssessmentOut,
    status_code=201,
)
def create_cognitive_assessment(
    payload: CognitiveAssessmentCreate,
    db: Session = Depends(get_db),
):
    astronaut = db.get(Astronaut, payload.astronaut_id)

    if not astronaut:
        raise HTTPException(
            status_code=404,
            detail="Astronaut not found.",
        )

    assessment = CognitiveAssessment(
        astronaut_id=payload.astronaut_id,
        duration_seconds=payload.duration_seconds,
        stimuli_count=payload.stimuli_count,
        valid_responses=payload.valid_responses,
        mean_reaction_ms=payload.mean_reaction_ms,
        median_reaction_ms=payload.median_reaction_ms,
        lapses_count=payload.lapses_count,
        simulated=payload.simulated,
        metadata_json=payload.metadata,
    )

    db.add(assessment)
    db.commit()
    db.refresh(assessment)

    return assessment


@router.get(
    "/astronauts/{astronaut_id}/cognitive-assessments",
    response_model=list[CognitiveAssessmentOut],
)
def get_cognitive_history(
    astronaut_id: str,
    limit: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    astronaut = db.get(Astronaut, astronaut_id)

    if not astronaut:
        raise HTTPException(
            status_code=404,
            detail="Astronaut not found.",
        )

    records = db.scalars(
        select(CognitiveAssessment)
        .where(
            CognitiveAssessment.astronaut_id == astronaut_id
        )
        .order_by(desc(CognitiveAssessment.completed_at))
        .limit(limit)
    ).all()

    return records


@router.get(
    "/astronauts/{astronaut_id}/cognitive-assessments/latest",
    response_model=CognitiveAssessmentOut,
)
def get_latest_cognitive_assessment(
    astronaut_id: str,
    db: Session = Depends(get_db),
):
    astronaut = db.get(Astronaut, astronaut_id)

    if not astronaut:
        raise HTTPException(
            status_code=404,
            detail="Astronaut not found.",
        )

    record = db.scalar(
        select(CognitiveAssessment)
        .where(
            CognitiveAssessment.astronaut_id == astronaut_id
        )
        .order_by(desc(CognitiveAssessment.completed_at))
        .limit(1)
    )

    if not record:
        raise HTTPException(
            status_code=404,
            detail="No cognitive assessment records found.",
        )

    return record