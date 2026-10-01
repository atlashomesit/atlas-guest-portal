// Support module for the gate-batch hygiene guard: a real module that the first fixture queues a `vi.doMock` for and the
// second fixture imports. If the queued mock crosses the file boundary the import returns the mock, not this value.
export const realValue = 42;
