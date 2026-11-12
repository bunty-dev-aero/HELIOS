from datetime import datetime, timezone

from sqlalchemy import (
    String,
    Float,
    DateTime,
    ForeignKey,
    Boolean,
    JSON,
    Text,
    Integer,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utc_now():
    return datetime.now(timezone.utc)


# --------------------------------------------------
# ASTRONAUT MODEL
# --------------------------------------------------

class Astronaut(Base):

    __tablename__ = "astronauts"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    mission_role: Mapped[str] = mapped_column(
        String(80),
        default="Crew member",
    )

    mission_day: Mapped[int] = mapped_column(
        default=1,
    )

    is_simulated: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
    )

    measurements: Mapped[list["Measurement"]] = relationship(
        back_populates="astronaut",
    )

    alerts: Mapped[list["Alert"]] = relationship(
        back_populates="astronaut",
    )


# --------------------------------------------------
# CREW MEASUREMENT MODEL
# --------------------------------------------------

class Measurement(Base):

    __tablename__ = "measurements"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    astronaut_id: Mapped[str] = mapped_column(
        ForeignKey("astronauts.id"),
        index=True,
    )

    metric: Mapped[str] = mapped_column(
        String(40),
        index=True,
    )

    value: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    unit: Mapped[str] = mapped_column(
        String(24),
        nullable=False,
    )

    measured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        index=True,
    )

    source: Mapped[str] = mapped_column(
        String(30),
        default="manual",
    )

    simulated: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
    )

    quality: Mapped[str] = mapped_column(
        String(20),
        default="unknown",
    )

    metadata_json: Mapped[dict] = mapped_column(
        "metadata",
        JSON,
        default=dict,
    )

    astronaut: Mapped["Astronaut"] = relationship(
        back_populates="measurements",
    )

    alerts: Mapped[list["Alert"]] = relationship(
        back_populates="measurement",
    )


# --------------------------------------------------
# ALERT MODEL
# --------------------------------------------------

class Alert(Base):

    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    astronaut_id: Mapped[str] = mapped_column(
        ForeignKey("astronauts.id"),
        nullable=False,
        index=True,
    )

    measurement_id: Mapped[int] = mapped_column(
        ForeignKey("measurements.id"),
        nullable=False,
        index=True,
    )

    level: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default="open",
        nullable=False,
        index=True,
    )

    metric: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
    )

    observed_value: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    unit: Mapped[str] = mapped_column(
        String(24),
        nullable=False,
    )

    baseline_median: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    median_absolute_deviation: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    robust_sigma: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    robust_deviation: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    direction: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )

    message: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    reason: Mapped[str] = mapped_column(
        String(1000),
        nullable=False,
    )

    recommended_action: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )

    simulated: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    baseline_snapshot: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
    )

    detection_snapshot: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
        index=True,
    )

    acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    astronaut: Mapped["Astronaut"] = relationship(
        back_populates="alerts",
    )

    measurement: Mapped["Measurement"] = relationship(
        back_populates="alerts",
    )


# --------------------------------------------------
# ENVIRONMENTAL MEASUREMENT MODEL
# --------------------------------------------------

class EnvironmentalMeasurement(Base):

    __tablename__ = "environmental_measurements"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    metric: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    value: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    unit: Mapped[str] = mapped_column(
        String(24),
        nullable=False,
    )

    measured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
        index=True,
    )

    sensor_id: Mapped[str | None] = mapped_column(
        String(80),
        nullable=True,
    )

    zone: Mapped[str] = mapped_column(
        String(80),
        default="main_cabin",
        nullable=False,
        index=True,
    )

    source: Mapped[str] = mapped_column(
        String(30),
        default="simulator",
        nullable=False,
    )

    simulated: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    quality: Mapped[str] = mapped_column(
        String(20),
        default="unknown",
        nullable=False,
    )

    metadata_json: Mapped[dict] = mapped_column(
        "metadata",
        JSON,
        default=dict,
    )


# --------------------------------------------------
# GROUND CONTROL COMMUNICATION MODEL
# --------------------------------------------------

class CommunicationMessage(Base):

    __tablename__ = "communication_messages"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    # Message direction:
    # crew_to_ground or ground_to_crew

    direction: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        index=True,
    )

    # Message sender

    sender: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    # Message recipient

    recipient: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    # Message contents

    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    # queued, in_transit, delivered, failed

    status: Mapped[str] = mapped_column(
        String(20),
        default="queued",
        nullable=False,
        index=True,
    )

    # Time when message was created

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
        index=True,
    )

    # Expected delivery timestamp

    scheduled_delivery_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )

    # Actual delivery timestamp

    delivered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Configured one-way communication delay

    delay_seconds: Mapped[int] = mapped_column(
        Integer,
        default=1200,
        nullable=False,
    )

    # Synthetic message identification

    simulated: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    # Additional transmission information

    metadata_json: Mapped[dict] = mapped_column(
        "metadata",
        JSON,
        default=dict,
    )

# --------------------------------------------------
# GROUND CONTROL COMMUNICATION LINK SETTINGS
# --------------------------------------------------

class CommunicationLink(Base):

    __tablename__ = "communication_link_settings"

    # Singleton settings record (ID = 1)
    id: Mapped[int] = mapped_column(
        primary_key=True,
        default=1,
    )

    # Communication delay in seconds (default: 20 minutes)
    delay_seconds: Mapped[int] = mapped_column(
        Integer,
        default=1200,
        nullable=False,
    )

    # online or blackout
    link_status: Mapped[str] = mapped_column(
        String(20),
        default="online",
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )