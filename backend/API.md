# Circle backend API

All routes below require an Authorization bearer token.
A resource outside the requester's circle returns 404.

## Events

- POST /circles/:circleId/events — create an event.
- GET /circles/:circleId/events — latest 50 by event date, descending.
- GET /circles/:circleId/events/:eventId — event details.
- PATCH /circles/:circleId/events/:eventId — author-only editing.
- DELETE /circles/:circleId/events/:eventId — author-only deletion, 204.
- PUT /circles/:circleId/events/:eventId/rsvp — set own response: GOING, MAYBE or NOT_GOING.
- DELETE /circles/:circleId/events/:eventId/rsvp — withdraw own response, 204.
- GET /circles/:circleId/events/:eventId/attendees — first 100 responses with safe user fields.

Creation body: title (nonblank, max 200), eventDate (ISO date), optional description (max 5000).
PATCH accepts the same fields, all optional; description may be cleared with null.
Any circle member can create/read and RSVP; only the author edits/deletes events.

## Memories

- POST /circles/:circleId/memories
- GET /circles/:circleId/memories — latest 50 by occurredAt, descending.
- GET /circles/:circleId/memories/:memoryId
- PATCH /circles/:circleId/memories/:memoryId — author only.
- DELETE /circles/:circleId/memories/:memoryId — author only, 204.

Creation body: title (nonblank, max 200), occurredAt (ISO date),
optional text (max 10000) and imageUrl (HTTP/HTTPS URL, max 2048).
PATCH accepts optional fields; text and imageUrl may be cleared with null.
An imageUrl is a reference to an existing image. File uploads/storage are not implemented.

## Search

GET /circles/:circleId/search?q=some-text

Returns up to 50 posts in the requested circle with safe author fields.
q must be nonblank and no longer than 200 characters.
Search is case-insensitive substring matching. SQL wildcard characters are treated literally.
This is not PostgreSQL full-text search; ranking, FTS indexes and cursor pagination remain future work.

## Invite management

- GET /circles/:circleId/invites — owner/admin only, all invite metadata.
- PATCH /circles/:circleId/invites/:inviteId/revoke — owner/admin only.
  Repeated revocation preserves the original revokedAt. Tokens and token hashes are not returned.

## Existing content

Posts and comments allow circle members to create/read; only authors edit/delete.
Post text limit: 5000. Comment text limit: 2000.
List endpoints currently return at most 50 records; cursor pagination is not implemented.

## Member management

- PATCH /circles/:circleId/members/:memberId — owner only; body role: ADMIN or MEMBER.
- DELETE /circles/:circleId/members/:memberId — owner removes admins/members; admins remove members only.
- DELETE /circles/:circleId/membership — leave the circle, 204.
  The owner cannot be demoted, removed or leave through these routes (409).
  Ownership transfer is not implemented. Leaving/removal preserves existing shared content.
  A removed member's token no longer grants access to private circle resources.

## Poll management

- POST /circles/:circleId/polls — title (max 200), options (2–10 distinct nonblank strings, max 200 each), optional future closesAt.
- GET /circles/:circleId/polls — latest 50 with options and vote counts.
- GET /circles/:circleId/polls/:pollId — details and counts.
- PATCH /circles/:circleId/polls/:pollId — author-only title change.
- PATCH /circles/:circleId/polls/:pollId/close — author-only close; repeated calls preserve the closing time.
- DELETE /circles/:circleId/polls/:pollId — author only, 204.
  Options are immutable after creation. Voting: POST /circles/:circleId/polls/:pollId/votes with { optionId }. One vote per member; closed polls and repeat votes return 409.
