import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Fund, PortfolioMetrics } from "../../../src/core/services/MutualFundService";
import { Colors, Spacing, Typography } from "../../../src/core/theme";

interface FundRow {
  fund: Fund;
  metrics: PortfolioMetrics;
}

interface FundPerformanceTableProps {
  funds: FundRow[];
  sortBy?: "xirr" | "expenseDrag" | "name";
}

/**
 * Fund Performance Table Component
 * Displays metrics for each fund in portfolio with sortable columns
 */
export function FundPerformanceTable({
  funds,
  sortBy = "xirr",
}: FundPerformanceTableProps) {
  const formatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formatINR = (value: number) => formatter.format(value);

  // Sort funds
  const sortedFunds = [...funds].sort((a, b) => {
    switch (sortBy) {
      case "xirr":
        return b.metrics.xirr - a.metrics.xirr;
      case "expenseDrag":
        return a.metrics.expenseDragAnnual - b.metrics.expenseDragAnnual;
      case "name":
        return a.fund.schemeName.localeCompare(b.fund.schemeName);
      default:
        return 0;
    }
  });

  // Get health status badge
  const getHealthStatus = (xirr: number): { label: string; color: string } => {
    if (xirr >= 12) return { label: "⭐ Excellent", color: Colors.teal };
    if (xirr >= 8) return { label: "✓ Good", color: Colors.gold };
    if (xirr >= 0) return { label: "~ Fair", color: Colors.purple };
    return { label: "✗ Poor", color: Colors.red };
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fund Performance</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tableScroll}
      >
        <View style={styles.table}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <Text style={[styles.headerCell, { flex: 3 }]}>Scheme Name</Text>
            <Text style={[styles.headerCell, { flex: 1.5 }]}>Category</Text>
            <Text style={[styles.headerCell, { flex: 1 }]}>XIRR %</Text>
            <Text style={[styles.headerCell, { flex: 1.5 }]}>Expense</Text>
            <Text style={[styles.headerCell, { flex: 1.5 }]}>Status</Text>
          </View>

          {/* Data Rows */}
          {sortedFunds.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>No funds found</Text>
            </View>
          ) : (
            sortedFunds.map((item, index) => {
              const healthStatus = getHealthStatus(item.metrics.xirr);
              return (
                <View key={`${item.fund.schemeCode}-${index}`} style={styles.dataRow}>
                  {/* Scheme Name */}
                  <View style={[styles.cell, { flex: 3 }]}>
                    <Text style={styles.schemeName}>{item.fund.schemeName}</Text>
                  </View>

                  {/* Category */}
                  <View style={[styles.cell, { flex: 1.5 }]}>
                    <Text style={styles.categoryText}>{item.fund.category}</Text>
                  </View>

                  {/* XIRR % */}
                  <View style={[styles.cell, { flex: 1 }]}>
                    <Text
                      style={[
                        styles.xirrValue,
                        {
                          color:
                            item.metrics.xirr >= 12
                              ? Colors.teal
                              : item.metrics.xirr >= 8
                                ? Colors.gold
                                : item.metrics.xirr >= 0
                                  ? Colors.purple
                                  : Colors.red,
                        },
                      ]}
                    >
                      {item.metrics.xirr.toFixed(1)}%
                    </Text>
                  </View>

                  {/* Expense Drag */}
                  <View style={[styles.cell, { flex: 1.5 }]}>
                    <Text style={[styles.expenseText, { color: Colors.red }]}>
                      {formatINR(item.metrics.expenseDragAnnual)}
                    </Text>
                    <Text style={styles.expenseSubtext}>
                      /yr
                    </Text>
                  </View>

                  {/* Status */}
                  <View style={[styles.cell, { flex: 1.5 }]}>
                    <Text style={[styles.statusBadge, { color: healthStatus.color }]}>
                      {healthStatus.label}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Performance Scale</Text>
        <View style={styles.legendItems}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.teal }]} />
            <Text style={styles.legendText}>XIRR ≥ 12% (Excellent)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.gold }]} />
            <Text style={styles.legendText}>XIRR 8-12% (Good)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.purple }]} />
            <Text style={styles.legendText}>XIRR 0-8% (Fair)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.red }]} />
            <Text style={styles.legendText}>XIRR &lt; 0% (Poor)</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.surface,
  },

  title: {
    fontSize: Typography.size["2xl"],
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },

  tableScroll: {
    marginBottom: Spacing.lg,
  },

  table: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },

  headerRow: {
    flexDirection: "row",
    backgroundColor: Colors.navy,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },

  headerCell: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
    textTransform: "uppercase",
  },

  dataRow: {
    flexDirection: "row",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  cell: {
    justifyContent: "center",
    paddingHorizontal: Spacing.sm,
  },

  schemeName: {
    fontSize: Typography.size.md,
    fontWeight: "600",
    color: Colors.textPrimary,
  },

  categoryText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "500",
  },

  xirrValue: {
    fontSize: Typography.size.md,
    fontWeight: "700",
  },

  expenseText: {
    fontSize: 12,
    fontWeight: "600",
  },

  expenseSubtext: {
    fontSize: 10,
    color: Colors.textSecondary,
  },

  statusBadge: {
    fontSize: 12,
    fontWeight: "600",
  },

  emptyRow: {
    paddingVertical: Spacing.lg,
    justifyContent: "center",
    alignItems: "center",
  },

  emptyText: {
    fontSize: Typography.size.md,
    color: Colors.textSecondary,
  },

  legend: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.lg,
  },

  legendTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    marginBottom: Spacing.sm,
  },

  legendItems: {
    gap: Spacing.sm,
  },

  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },

  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  legendText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
