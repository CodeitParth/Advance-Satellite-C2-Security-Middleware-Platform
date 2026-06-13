"""Fire-and-forget task spawning that survives GC and logs failures.

asyncio.create_task() returns a Task the event loop holds only weakly — if the
caller drops the reference, the task can be garbage-collected mid-flight and
its exception silently lost. spawn() keeps a strong reference until completion
and logs any unhandled exception.
"""
import asyncio
import logging
from collections.abc import Coroutine

logger = logging.getLogger(__name__)

_background_tasks: set[asyncio.Task] = set()


def spawn(coro: Coroutine, *, name: str | None = None) -> asyncio.Task:
    task = asyncio.get_running_loop().create_task(coro, name=name)
    _background_tasks.add(task)
    task.add_done_callback(_on_done)
    return task


def _on_done(task: asyncio.Task) -> None:
    _background_tasks.discard(task)
    if task.cancelled():
        return
    exc = task.exception()
    if exc is not None:
        logger.error("Background task %r failed: %s", task.get_name(), exc, exc_info=exc)
