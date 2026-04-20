# Golden Test Snapshots

This directory stores golden snapshot files used by golden tests for regression detection.

## Usage

Golden tests compare output against stored snapshots to detect regressions.

```bash
# Update snapshots (accept new outputs as correct)
UPDATE_GOLDEN=1 npm run test:golden

# Run golden tests normally (compare against snapshots)
npm run test:golden
```

## File Format

Snapshots are stored as `.golden` files with the expected output:
```
{...JSON output...}
```

## Adding New Golden Tests

1. Create a new test file in `tests/golden/`
2. Use `assertGolden(snapshotName, actualOutput)` to compare
3. Run `UPDATE_GOLDEN=1 npm run test:golden` to generate initial snapshot
4. Commit the generated `.golden` files
