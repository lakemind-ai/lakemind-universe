import logging

logger = logging.getLogger(__name__)


def glossary_sync_job():
    """Periodic job: checks for stale draft versions and logs warnings."""
    logger.info("[CRON] glossary_sync_job: checking for stale glossary drafts")
    try:
        from app.utils.app_db import db_context
        from app.models.glossary import GlossaryVersion
        from datetime import datetime, timezone, timedelta

        with db_context() as db:
            stale_threshold = datetime.now(timezone.utc) - timedelta(days=7)
            stale_drafts = db.query(GlossaryVersion).filter(
                GlossaryVersion.status == "draft",
                GlossaryVersion.created_at < stale_threshold,
            ).all()

            if stale_drafts:
                logger.warning(
                    f"[CRON] Found {len(stale_drafts)} stale glossary draft(s) older than 7 days"
                )
                for draft in stale_drafts:
                    logger.warning(
                        f"[CRON] Stale draft: version {draft.version_number} "
                        f"(created {draft.created_at})"
                    )
            else:
                logger.info("[CRON] No stale glossary drafts found")

    except Exception as e:
        logger.error(f"[CRON] glossary_sync_job failed: {e}")


def get_scheduler_jobs(scheduler):
    """Register all cron jobs with the APScheduler instance."""
    scheduler.add_job(
        glossary_sync_job,
        trigger="interval",
        minutes=60,
        id="glossary_sync_job",
        replace_existing=True,
    )
    return scheduler
