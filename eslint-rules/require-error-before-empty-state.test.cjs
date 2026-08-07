/**
 * Test harness for require-error-before-empty-state (TASK-7195).
 * Run: node eslint-rules/require-error-before-empty-state.test.cjs
 */
const rule = require("./require-error-before-empty-state.cjs");
const { RuleTester } = require("eslint");

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

ruleTester.run("require-error-before-empty-state", rule, {
  valid: [
    // Fixed shape (ReconciliationMismatchesPage / TenantFinanceLedgerPage / Guests.tsx):
    // a dedicated `loadFailed` boolean interposed between loading and the length check.
    `function Page() {
      const [loading, setLoading] = useState(true);
      const [loadFailed, setLoadFailed] = useState(false);
      const [rows, setRows] = useState([]);
      return (
        <div>
          {loading ? (
            <Spinner />
          ) : loadFailed ? (
            <PageErrorState />
          ) : rows.length === 0 ? (
            <EmptyState />
          ) : (
            <Table rows={rows} />
          )}
        </div>
      );
    }`,

    // The tracked variable itself (not a derived boolean) checked directly.
    `function Page() {
      const [isLoading, setIsLoading] = useState(false);
      const [fetchError, setFetchError] = useState('');
      const [items, setItems] = useState([]);
      return (
        <div>
          {isLoading ? (
            <Spinner />
          ) : fetchError ? (
            <Alert>{fetchError}</Alert>
          ) : items.length === 0 ? (
            <Empty />
          ) : (
            <List items={items} />
          )}
        </div>
      );
    }`,

    // Destructured off a resource-state hook, renamed on the way out.
    `function Page() {
      const { isLoading, isError: loadFailed, data } = useResourceState();
      const rows = data ?? [];
      return (
        <div>
          {isLoading ? (
            <Spinner />
          ) : loadFailed ? (
            <PageErrorState />
          ) : rows.length === 0 ? (
            <Empty />
          ) : (
            <Table rows={rows} />
          )}
        </div>
      );
    }`,

    // No error-like state tracked anywhere in the component — a different problem (no error
    // tracking at all) than the one this rule targets (tracked but unchecked).
    `function Page() {
      const [loading, setLoading] = useState(false);
      const [rows, setRows] = useState([]);
      return (
        <div>
          {loading ? <Spinner /> : rows.length === 0 ? <Empty /> : <Table rows={rows} />}
        </div>
      );
    }`,

    // Not a resource chain at all — a plain numeric ternary, not JSX.
    `function calc() {
      const error = getError();
      const list = [];
      return loading ? 1 : list.length === 0 ? 2 : 3;
    }`,

    // Escape hatch — reviewed and accepted.
    `function Page() {
      const [loading, setLoading] = useState(false);
      const [fetchError, setFetchError] = useState('');
      const [rows, setRows] = useState([]);
      return (
        <div>
          {loading ? (
            <Spinner />
          ) : rows.length === 0 ? ( // four-state-ok: TASK-1234 legacy screen, tracked separately
            <Empty />
          ) : (
            <Table rows={rows} />
          )}
        </div>
      );
    }`,

    // Guests.tsx top-level shape: `loading && list.length === 0` is a "still loading, nothing
    // yet" skeleton guard (positive `loading` combined with the length check), not an
    // empty-result claim — must not be misread as an unguarded empty branch.
    `function Page() {
      const [loading, setLoading] = useState(false);
      const [loadFailed, setLoadFailed] = useState(false);
      const [guests, setGuests] = useState([]);
      return (
        <div>
          {loading && guests.length === 0 ? (
            <PageLoadingState />
          ) : loadFailed ? (
            <PageErrorState />
          ) : (
            <GuestsTable guests={guests} />
          )}
        </div>
      );
    }`,

    // Loading branch with no emptiness test anywhere in the chain — nothing to protect.
    `function Page() {
      const [loading, setLoading] = useState(false);
      const [fetchError, setFetchError] = useState('');
      const [detail, setDetail] = useState(null);
      return <div>{loading ? <Spinner /> : <Detail data={detail} />}</div>;
    }`,

    // Emptiness test with no loading branch anywhere in the chain — not a fetch-resource chain
    // by this rule's gating (e.g. a local, synchronous, non-fetched derived list).
    `function Page() {
      const [fetchError, setFetchError] = useState('');
      const options = computeLocalOptions();
      return <div>{options.length === 0 ? <NoMatches /> : <Options options={options} />}</div>;
    }`,
  ],

  invalid: [
    // The actual Bookings.tsx shape: fetchError tracked, never referenced in the ternary.
    {
      code: `function Bookings() {
        const [isLoading, setIsLoading] = useState(false);
        const [fetchError, setFetchError] = useState('');
        const [sortedBookings, setSortedBookings] = useState([]);
        return (
          <div>
            {isLoading ? (
              <TableContainer />
            ) : sortedBookings.length === 0 ? (
              <EmptyState title="No bookings yet" />
            ) : (
              <Table rows={sortedBookings} />
            )}
          </div>
        );
      }`,
      errors: [{ message: /Four-state violation \(TASK-7195\)/ }],
    },

    // apiError naming variant.
    {
      code: `function Page() {
        const [loading, setLoading] = useState(false);
        const [apiError, setApiError] = useState(null);
        const [rows, setRows] = useState([]);
        return (
          <div>
            {loading ? <Spinner /> : rows.length === 0 ? <Empty /> : <Table rows={rows} />}
          </div>
        );
      }`,
      errors: [{ message: /apiError/ }],
    },

    // hasError / isError naming variant, tracked via useState directly (not a hook).
    {
      code: `function Page() {
        const [loading, setLoading] = useState(false);
        const [hasError, setHasError] = useState(false);
        const [items, setItems] = useState([]);
        return (
          <div>
            {loading ? <Spinner /> : items.length === 0 ? <Empty /> : <List items={items} />}
          </div>
        );
      }`,
      errors: [{ message: /hasError/ }],
    },

    // Error check exists but is positioned AFTER the empty check — the empty branch still wins
    // first for a genuinely failed load (rows stays [] on error), so this is the same defect.
    {
      code: `function Page() {
        const [loading, setLoading] = useState(false);
        const [loadFailed, setLoadFailed] = useState(false);
        const [rows, setRows] = useState([]);
        return (
          <div>
            {loading ? (
              <Spinner />
            ) : rows.length === 0 ? (
              <Empty />
            ) : loadFailed ? (
              <PageErrorState />
            ) : (
              <Table rows={rows} />
            )}
          </div>
        );
      }`,
      errors: [{ message: /Four-state violation \(TASK-7195\)/ }],
    },

    // Destructured-and-renamed error binding that is tracked but never consulted.
    {
      code: `function Page() {
        const { isLoading, isError: loadFailed, data } = useResourceState();
        const rows = data ?? [];
        return (
          <div>
            {isLoading ? <Spinner /> : rows.length === 0 ? <Empty /> : <Table rows={rows} />}
          </div>
        );
      }`,
      errors: [{ message: /loadFailed/ }],
    },

    // A wrong-line marker must not excuse it (mirrors house convention in no-utc-today.test.cjs).
    {
      code: `function Page() {
        const [loading, setLoading] = useState(false);
        const [fetchError, setFetchError] = useState('');
        const [rows, setRows] = useState([]);
        return (
          <div>
            {/* four-state-ok: on the wrong line */}
            {loading ? (
              <Spinner />
            ) : rows.length === 0 ? (
              <Empty />
            ) : (
              <Table rows={rows} />
            )}
          </div>
        );
      }`,
      errors: [{ message: /Four-state violation \(TASK-7195\)/ }],
    },
  ],
});

console.log("require-error-before-empty-state: all rule-tester cases passed");
