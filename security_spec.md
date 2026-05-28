# Security Spec for KosConnect

## Data Invariants
1. A booking cannot exist without a valid roomId and userUid.
2. A payment must be linked to a booking.
3. Only admins can confirm payments and update room inventory.
4. Users can only read their own bookings, complaints, and payments.
5. Users can only create their own bookings and complaints.
6. Rooms are publicly readable but only writable by admins.

## The "Dirty Dozen" Payloads
1. Create a booking for another userUid. (DENIED)
2. Update a booking status to 'confirmed' without admin rights. (DENIED)
3. Create a room without admin rights. (DENIED)
4. Read another user's complaint. (DENIED)
5. Delete a room as a regular user. (DENIED)
6. Escalate own role to 'admin' in user profile. (DENIED)
7. Create a payment with status 'confirmed'. (DENIED)
8. Update a room price as a user. (DENIED)
9. Read all user profiles as a regular user. (DENIED)
10. Update 'createdAt' timestamp on a booking. (DENIED)
11. Inject 1MB string into roomId field. (DENIED)
12. Create a booking with a negative durationMonths. (DENIED)

## Test Runner (Logic Overview)
The `firestore.rules` will be validated against these scenarios using granular helpers.
