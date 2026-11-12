from datetime import datetime, timezone, date

from sqlalchemy import (
    String,
    Integer,
    Float,
    Date,
    DateTime,
    Boolean,
    Text,
    ForeignKey,
    UniqueConstraint,
    JSON,
)

from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def utc_now():
    return datetime.now(timezone.utc)


# ==================================================
# DAILY CREW CHECK-IN MODEL
# ==================================================

class DailyCheckIn(Base):

    __tablename__ = "daily_checkins"

    __table_args__ = (
        UniqueConstraint(
            "astronaut_id",
            "checkin_date",
            name="uq_astronaut_daily_checkin",
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    astronaut_id: Mapped[str] = mapped_column(
        ForeignKey("astronauts.id"),
        nullable=False,
        index=True,
    )

    checkin_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    mood_score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    stress_score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    fatigue_score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    sleep_quality_score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    simulated: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    metadata_json: Mapped[dict] = mapped_column(
        "metadata",
        JSON,
        default=dict,
    )


# ==================================================
# COGNITIVE ASSESSMENT MODEL
# ==================================================

class CognitiveAssessment(Base):

    __tablename__ = "cognitive_assessments"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    astronaut_id: Mapped[str] = mapped_column(
        ForeignKey("astronauts.id"),
        nullable=False,
        index=True,
    )

    # Test configuration

    duration_seconds: Mapped[int] = mapped_column(
        Integer,
        default=180,
        nullable=False,
    )

    # Response statistics

    stimuli_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    valid_responses: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    mean_reaction_ms: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    median_reaction_ms: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    lapses_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    # Assessment timestamp

    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
        index=True,
    )

    # Data provenance

    simulated: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    metadata_json: Mapped[dict] = mapped_column(
        "metadata",
        JSON,
        default=dict,
    )