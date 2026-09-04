from crewai.tools import tool

_FAKE_TICKETS = {
    "TICKET-101": {"status": "Open", "subject": "Cannot reset password", "priority": "High"},
    "TICKET-102": {"status": "Resolved", "subject": "Invoice mismatch", "priority": "Medium"},
}


@tool("ticket_lookup")
def ticket_lookup(ticket_id: str) -> str:
    """Look up a support ticket by ID (mock ticketing system)."""
    ticket = _FAKE_TICKETS.get(ticket_id)
    if ticket is None:
        return f"No ticket found with ID '{ticket_id}'."
    return f"{ticket_id}: status={ticket['status']}, subject='{ticket['subject']}', priority={ticket['priority']}"
