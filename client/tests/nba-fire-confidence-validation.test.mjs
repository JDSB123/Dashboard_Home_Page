/**
 * NBA Fire Rating & Confidence Status Validation Tests
 *
 * REGRESSION TEST for backend confidence_status handling:
 * - Backend returns confidence_status: UNVALIDATED / NO_PICK / null
 * - Backend confidence field may be 'low' (hardcoded) or null
 * - Frontend MUST NOT fabricate fire ratings from unvalidated data
 *
 * Test cases:
 * 1. UNVALIDATED confidence_status -> fire = null, show "N/A"
 * 2. NO_PICK confidence_status -> fire = null, show "N/A"
 * 3. null/missing confidence + null confidence_status -> compute from edge (legacy)
 * 4. VALIDATED confidence_status + valid confidence -> trust and display
 * 5. Stale/locked market handling
 * 6. Zero/null/string edge handling
 * 7. Out-of-range fire values clamping
 */

import { strict as assert } from "assert";

/**
 * Mock normalizeFireRating function (matches unified-picks-fetcher.js implementation)
 */
function normalizeFireRating(rawFire, edgeValue = 0, confidenceStatus = null) {
  const clamp = (n) => Math.max(0, Math.min(5, n));

  const statusUpper = (confidenceStatus ?? "").toString().trim().toUpperCase();
  const isValidated =
    statusUpper === "VALIDATED" || statusUpper === "HIGH_CONFIDENCE";
  const isUnvalidated = statusUpper === "UNVALIDATED";
  const isNoPick =
    statusUpper === "NO_PICK" ||
    statusUpper === "LOCKED" ||
    statusUpper === "UNAVAILABLE";

  if (isNoPick || isUnvalidated) {
    return {
      fire: null,
      fireLabel: "",
      unavailable: true,
      status: statusUpper,
    };
  }

  if (rawFire !== null && rawFire !== undefined && rawFire !== "") {
    if (typeof rawFire === "number" && Number.isFinite(rawFire)) {
      const fire = clamp(Math.round(rawFire));
      return { fire, fireLabel: fire === 5 ? "MAX" : "", unavailable: false };
    }

    const str = rawFire.toString().trim();
    if (str) {
      const asNum = parseInt(str, 10);
      if (!Number.isNaN(asNum)) {
        const fire = clamp(asNum);
        return {
          fire,
          fireLabel: fire === 5 ? "MAX" : "",
          unavailable: false,
        };
      }

      const upper = str.toUpperCase();
      const map = {
        MAX: 5,
        ELITE: 5,
        STRONG: 4,
        GOOD: 3,
        STANDARD: 2,
        LOW: 1,
      };
      if (upper in map) {
        const fire = map[upper];
        return {
          fire,
          fireLabel: fire === 5 ? "MAX" : "",
          unavailable: false,
        };
      }

      if (str.includes("%")) {
        const pct = parseFloat(str.replace("%", ""));
        if (!Number.isNaN(pct)) {
          if (pct >= 80)
            return { fire: 5, fireLabel: "MAX", unavailable: false };
          if (pct >= 65) return { fire: 4, fireLabel: "", unavailable: false };
          if (pct >= 50) return { fire: 3, fireLabel: "", unavailable: false };
          if (pct >= 35) return { fire: 2, fireLabel: "", unavailable: false };
          return { fire: 1, fireLabel: "", unavailable: false };
        }
      }
    }
  }

  if (!confidenceStatus && typeof edgeValue === "number" && edgeValue > 0) {
    const computed = clamp(Math.ceil(edgeValue / 1.5));
    return {
      fire: computed,
      fireLabel: computed === 5 ? "MAX" : "",
      unavailable: false,
    };
  }

  return { fire: null, fireLabel: "", unavailable: true, status: "UNKNOWN" };
}

/**
 * Mock fireEmoji function
 */
function fireEmoji(fire, unavailable = false) {
  if (fire === null || fire === undefined || unavailable) {
    return '<span class="fire-unavailable" title="Confidence unavailable">N/A</span>';
  }
  const n = Math.max(0, Math.min(5, parseInt(fire, 10) || 0));
  if (n <= 0)
    return '<span class="fire-unavailable" title="Confidence unavailable">N/A</span>';
  return "🔥".repeat(n);
}

// ============================================================================
// TEST SUITE
// ============================================================================

console.log("\n=== NBA Fire Rating & Confidence Status Tests ===\n");

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(`   ${err.message}`);
    failCount++;
  }
}

// ----------------------------------------------------------------------------
// TEST 1: UNVALIDATED confidence_status returns null fire
// ----------------------------------------------------------------------------
test("UNVALIDATED confidence_status -> fire = null", () => {
  const result = normalizeFireRating("low", 3.5, "UNVALIDATED");
  assert.strictEqual(
    result.fire,
    null,
    "UNVALIDATED status must return null fire",
  );
  assert.strictEqual(
    result.unavailable,
    true,
    "UNVALIDATED must set unavailable=true",
  );
  assert.strictEqual(result.status, "UNVALIDATED");
});

test("UNVALIDATED with hardcoded 'low' string -> fire = null", () => {
  const result = normalizeFireRating("low", 0, "UNVALIDATED");
  assert.strictEqual(result.fire, null);
  assert.strictEqual(result.unavailable, true);
});

// ----------------------------------------------------------------------------
// TEST 2: NO_PICK confidence_status returns null fire
// ----------------------------------------------------------------------------
test("NO_PICK confidence_status -> fire = null", () => {
  const result = normalizeFireRating(3, 5.0, "NO_PICK");
  assert.strictEqual(result.fire, null, "NO_PICK status must return null fire");
  assert.strictEqual(result.unavailable, true);
  assert.strictEqual(result.status, "NO_PICK");
});

test("LOCKED confidence_status -> fire = null", () => {
  const result = normalizeFireRating(4, 2.5, "LOCKED");
  assert.strictEqual(result.fire, null);
  assert.strictEqual(result.unavailable, true);
});

// ----------------------------------------------------------------------------
// TEST 3: VALIDATED confidence_status trusts confidence value
// ----------------------------------------------------------------------------
test("VALIDATED + confidence='low' -> fire = 1", () => {
  const result = normalizeFireRating("low", 0, "VALIDATED");
  assert.strictEqual(result.fire, 1, "VALIDATED status trusts 'low' -> 1");
  assert.strictEqual(result.unavailable, false);
});

test("VALIDATED + confidence=4 -> fire = 4", () => {
  const result = normalizeFireRating(4, 0, "VALIDATED");
  assert.strictEqual(result.fire, 4);
  assert.strictEqual(result.unavailable, false);
});

test("HIGH_CONFIDENCE + confidence='ELITE' -> fire = 5", () => {
  const result = normalizeFireRating("ELITE", 0, "HIGH_CONFIDENCE");
  assert.strictEqual(result.fire, 5);
  assert.strictEqual(result.fireLabel, "MAX");
  assert.strictEqual(result.unavailable, false);
});

// ----------------------------------------------------------------------------
// TEST 4: Legacy mode (no confidence_status) computes from edge
// ----------------------------------------------------------------------------
test("No confidence_status + edge=4.5 -> compute from edge", () => {
  const result = normalizeFireRating(null, 4.5, null);
  assert.strictEqual(result.fire, 3, "edge 4.5 -> ceil(4.5/1.5) = 3");
  assert.strictEqual(result.unavailable, false);
});

test("No confidence_status + edge=7.5 -> fire = 5", () => {
  const result = normalizeFireRating(null, 7.5, null);
  assert.strictEqual(result.fire, 5, "edge 7.5 -> ceil(7.5/1.5) = 5 (clamped)");
});

test("No confidence_status + edge=0 -> fire = null", () => {
  const result = normalizeFireRating(null, 0, null);
  assert.strictEqual(result.fire, null, "Zero edge with no confidence -> null");
  assert.strictEqual(result.unavailable, true);
});

// ----------------------------------------------------------------------------
// TEST 5: Null/missing confidence + UNVALIDATED status -> null fire
// ----------------------------------------------------------------------------
test("null confidence + UNVALIDATED -> fire = null", () => {
  const result = normalizeFireRating(null, 5.0, "UNVALIDATED");
  assert.strictEqual(result.fire, null);
  assert.strictEqual(result.unavailable, true);
});

test("empty string confidence + UNVALIDATED -> fire = null", () => {
  const result = normalizeFireRating("", 3.0, "UNVALIDATED");
  assert.strictEqual(result.fire, null);
  assert.strictEqual(result.unavailable, true);
});

// ----------------------------------------------------------------------------
// TEST 6: Edge handling - zero, null, negative
// ----------------------------------------------------------------------------
test("null edge + null confidence + no status -> fire = null", () => {
  const result = normalizeFireRating(null, null, null);
  assert.strictEqual(result.fire, null);
  assert.strictEqual(result.unavailable, true);
});

test("negative edge -> ignore, fire = null", () => {
  const result = normalizeFireRating(null, -2.5, null);
  assert.strictEqual(result.fire, null);
});

test("string edge (invalid) -> fire = null", () => {
  const result = normalizeFireRating(null, "invalid", null);
  assert.strictEqual(result.fire, null);
});

// ----------------------------------------------------------------------------
// TEST 7: Fire value clamping
// ----------------------------------------------------------------------------
test("rawFire = 10 (out of range) -> clamp to 5", () => {
  const result = normalizeFireRating(10, 0, "VALIDATED");
  assert.strictEqual(result.fire, 5);
});

test("rawFire = -1 (negative) -> clamp to 0 -> null", () => {
  const result = normalizeFireRating(-1, 0, "VALIDATED");
  assert.strictEqual(result.fire, 0);
});

test("rawFire = 3.7 (decimal) -> round to 4", () => {
  const result = normalizeFireRating(3.7, 0, "VALIDATED");
  assert.strictEqual(result.fire, 4);
});

// ----------------------------------------------------------------------------
// TEST 8: fireEmoji rendering
// ----------------------------------------------------------------------------
test("fireEmoji(null, false) -> N/A", () => {
  const html = fireEmoji(null, false);
  assert.ok(html.includes("N/A"), "null fire should render N/A");
  assert.ok(html.includes("fire-unavailable"), "should have unavailable class");
});

test("fireEmoji(3, false) -> 🔥🔥🔥", () => {
  const html = fireEmoji(3, false);
  assert.strictEqual(html, "🔥🔥🔥");
});

test("fireEmoji(5, false) -> 🔥🔥🔥🔥🔥", () => {
  const html = fireEmoji(5, false);
  assert.strictEqual(html, "🔥🔥🔥🔥🔥");
});

test("fireEmoji(3, true) -> N/A (unavailable flag overrides)", () => {
  const html = fireEmoji(3, true);
  assert.ok(html.includes("N/A"), "unavailable flag forces N/A");
});

test("fireEmoji(0, false) -> N/A", () => {
  const html = fireEmoji(0, false);
  assert.ok(html.includes("N/A"), "zero fire should render N/A");
});

// ----------------------------------------------------------------------------
// TEST 9: Real backend payloads (NBA examples)
// ----------------------------------------------------------------------------
test("Backend payload: confidence='low', status=UNVALIDATED -> null", () => {
  // Backend currently returns hardcoded 'low' with UNVALIDATED status
  const backendPick = {
    confidence: "low",
    confidence_status: "UNVALIDATED",
    edge: 3.2,
  };

  const result = normalizeFireRating(
    backendPick.confidence,
    backendPick.edge,
    backendPick.confidence_status,
  );

  assert.strictEqual(
    result.fire,
    null,
    "UNVALIDATED backend confidence must be ignored",
  );
  assert.strictEqual(result.unavailable, true);
});

test("Backend payload: confidence=null, status=NO_PICK -> null", () => {
  const backendPick = {
    confidence: null,
    confidence_status: "NO_PICK",
    edge: 0,
  };

  const result = normalizeFireRating(
    backendPick.confidence,
    backendPick.edge,
    backendPick.confidence_status,
  );

  assert.strictEqual(result.fire, null);
  assert.strictEqual(result.status, "NO_PICK");
});

test("Backend payload: confidence=4, status=VALIDATED -> fire = 4", () => {
  const backendPick = {
    confidence: 4,
    confidence_status: "VALIDATED",
    edge: 5.0,
  };

  const result = normalizeFireRating(
    backendPick.confidence,
    backendPick.edge,
    backendPick.confidence_status,
  );

  assert.strictEqual(result.fire, 4);
  assert.strictEqual(result.unavailable, false);
});

// ============================================================================
// TEST SUMMARY
// ============================================================================

console.log("\n" + "=".repeat(60));
console.log(`TOTAL: ${passCount + failCount} tests`);
console.log(`✅ PASS: ${passCount}`);
console.log(`❌ FAIL: ${failCount}`);

if (failCount > 0) {
  console.log("\n⚠️  Some tests FAILED. Review implementation.");
  process.exit(1);
} else {
  console.log("\n🎉 All tests PASSED!");
  process.exit(0);
}
