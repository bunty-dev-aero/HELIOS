from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import CommunicationMessage, CommunicationLink
from app.schemas import (
    CommunicationMessageCreate,
    CommunicationMessageOut,
    CommunicationLinkSettings,
    CommunicationLinkSettingsOut,
)

router = APIRouter()


# --------------------------------------------------
# TIME UTILITIES
# --------------------------------------------------

def utc_now():
    return datetime.now(timezone.utc)


def normalize_datetime(value):
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


# --------------------------------------------------
# COMMUNICATION LINK SETTINGS
# --------------------------------------------------

def get_or_create_link(db: Session):
    link = db.get(CommunicationLink, 1)

    if link is None:
        link = CommunicationLink(
            id=1,
            delay_seconds=1200,
            link_status="online",
        )
        db.add(link)
        db.commit()
        db.refresh(link)

    return link


def process_pending_messages(db: Session):
    link = get_or_create_link(db)

    if link.link_status != "online":
        return

    now = utc_now()

    pending = db.scalars(
        select(CommunicationMessage).where(
            CommunicationMessage.status.in_(
                ["queued", "in_transit"]
            )
        )
    ).all()

    for message in pending:
        delivery_time = normalize_datetime(
            message.scheduled_delivery_at
        )

        if delivery_time <= now:
            message.status = "delivered"
            message.delivered_at = now

    db.commit()


@router.get(
    "/communication/settings",
    response_model=CommunicationLinkSettingsOut,
)
def get_communication_settings(
    db: Session = Depends(get_db),
):
    link = get_or_create_link(db)

    return {
        "delay_seconds": link.delay_seconds,
        "link_status": link.link_status,
        "updated_at": link.updated_at,
    }


@router.put(
    "/communication/settings",
    response_model=CommunicationLinkSettingsOut,
)
def update_communication_settings(
    payload: CommunicationLinkSettings,
    db: Session = Depends(get_db),
):
    link = get_or_create_link(db)

    link.delay_seconds = payload.delay_seconds
    link.link_status = payload.link_status
    link.updated_at = utc_now()

    db.commit()
    db.refresh(link)

    if link.link_status == "online":
        process_pending_messages(db)

    return {
        "delay_seconds": link.delay_seconds,
        "link_status": link.link_status,
        "updated_at": link.updated_at,
    }


# --------------------------------------------------
# SEND COMMUNICATION MESSAGE
# --------------------------------------------------

@router.post(
    "/communication/messages",
    response_model=CommunicationMessageOut,
    status_code=201,
)
def send_communication_message(
    payload: CommunicationMessageCreate,
    db: Session = Depends(get_db),
):
    link = get_or_create_link(db)

    process_pending_messages(db)

    now = utc_now()

    scheduled_delivery = now + timedelta(
        seconds=link.delay_seconds
    )

    status = (
        "in_transit"
        if link.link_status == "online"
        else "queued"
    )

    message = CommunicationMessage(
        direction=payload.direction,
        sender=payload.sender,
        recipient=payload.recipient,
        message=payload.message,
        status=status,
        created_at=now,
        scheduled_delivery_at=scheduled_delivery,
        delay_seconds=link.delay_seconds,
        delivered_at=None,
        simulated=True,
        metadata_json=payload.metadata,
    )

    db.add(message)
    db.commit()
    db.refresh(message)

    return message


# --------------------------------------------------
# MESSAGE HISTORY
# --------------------------------------------------

@router.get(
    "/communication/messages",
    response_model=list[CommunicationMessageOut],
)
def list_communication_messages(
    direction: str | None = None,
    status: str | None = None,
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    process_pending_messages(db)

    query = select(
        CommunicationMessage
    ).order_by(
        desc(CommunicationMessage.created_at)
    )

    if direction:
        if direction not in (
            "crew_to_ground",
            "ground_to_crew",
        ):
            raise HTTPException(
                422,
                "Invalid communication direction.",
            )

        query = query.where(
            CommunicationMessage.direction == direction
        )

    if status:
        if status not in (
            "queued",
            "in_transit",
            "delivered",
            "failed",
        ):
            raise HTTPException(
                422,
                "Invalid message status.",
            )

        query = query.where(
            CommunicationMessage.status == status
        )

    return db.scalars(
        query.limit(limit)
    ).all()


# --------------------------------------------------
# SINGLE MESSAGE DETAILS
# --------------------------------------------------

@router.get(
    "/communication/messages/{message_id}",
    response_model=CommunicationMessageOut,
)
def get_communication_message(
    message_id: int,
    db: Session = Depends(get_db),
):
    process_pending_messages(db)

    message = db.get(
        CommunicationMessage,
        message_id,
    )

    if message is None:
        raise HTTPException(
            404,
            "Communication message not found.",
        )

    return message


# --------------------------------------------------
# PROCESS MESSAGE QUEUE
# --------------------------------------------------

@router.post("/communication/process")
def process_communication_queue(
    db: Session = Depends(get_db),
):
    before = db.scalar(
        select(CommunicationMessage.id).where(
            CommunicationMessage.status == "in_transit"
        ).limit(1)
    )

    process_pending_messages(db)

    link = get_or_create_link(db)

    delivered_count = db.query(
        CommunicationMessage
    ).filter(
        CommunicationMessage.status == "delivered",
        CommunicationMessage.delivered_at.is_not(None),
    ).count()

    pending_count = db.query(
        CommunicationMessage
    ).filter(
        CommunicationMessage.status.in_(
            ["queued", "in_transit"]
        )
    ).count()

    return {
        "success": True,
        "link_status": link.link_status,
        "pending_messages": pending_count,
        "total_delivered_messages": delivered_count,
        "processed": True,
        "disclaimer": "Simulated communication system.",
    }
