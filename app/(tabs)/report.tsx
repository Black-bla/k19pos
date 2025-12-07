import Screen from '@/components/Screen';
import { useTheme } from '@/context/ThemeContext';
import { useReporting } from '@/hooks/useReporting';
import { CategorySummary, OrderWithDetails, WaiterSummary } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { format, subDays } from 'date-fns';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function DailyReportScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const { report, loading, error, fetchDailyReport } = useReporting();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    fetchDailyReport(selectedDate);
  }, [selectedDate, fetchDailyReport]);

  const handleDateChange = (days: number) => {
    const newDate = subDays(new Date(selectedDate), -days);
    setSelectedDate(format(newDate, 'yyyy-MM-dd'));
  };

  const handleExportCSV = () => {
    if (!report) return;

    let csv = 'Daily Report - ' + selectedDate + '\n\n';

    // Summary section
    csv += 'SUMMARY\n';
    csv += `Total Orders,${report.summary.total_orders}\n`;
    csv += `Total Guests,${report.summary.total_guests}\n`;
    csv += `Gross Sales,${report.summary.gross_sales.toFixed(2)}\n`;
    csv += `Total Tips,${report.summary.total_tips.toFixed(2)}\n`;
    csv += `Net Revenue,${report.summary.net_revenue.toFixed(2)}\n`;
    csv += `Average Check Size,${report.summary.avg_check_size.toFixed(2)}\n`;
    csv += `Items Sold,${report.summary.items_sold}\n`;
    csv += `Payment Success Rate,${report.summary.payment_success_rate.toFixed(1)}%\n\n`;

    // Orders section
    csv += 'ORDERS\n';
    csv += 'Guest,Table,Waiter,Item,Quantity,Price,Subtotal,Time\n';
    report.orders.forEach((order: OrderWithDetails) => {
      csv += `${order.guest_name},${order.table_name},${order.waiter_name || 'N/A'},${order.menu_item_name},${order.quantity},${order.price_snapshot.toFixed(2)},${order.subtotal.toFixed(2)},${format(new Date(order.created_at), 'HH:mm')}\n`;
    });

    csv += '\nWAITER SUMMARY\n';
    csv += 'Waiter,Orders,Total Sales,Tips,Net Revenue,Avg Check\n';
    report.waiters.forEach((waiter: WaiterSummary) => {
      csv += `${waiter.waiter_name},${waiter.order_count},${waiter.total_sales.toFixed(2)},${waiter.total_tips.toFixed(2)},${waiter.net_revenue.toFixed(2)},${waiter.avg_check_size.toFixed(2)}\n`;
    });

    csv += '\nCATEGORY BREAKDOWN\n';
    csv += 'Category,Items,Quantity,Revenue,%Sales\n';
    report.categories.forEach((cat: CategorySummary) => {
      csv += `${cat.category},${cat.item_count},${cat.quantity_sold},${cat.total_revenue.toFixed(2)},${cat.percentage_of_sales.toFixed(1)}%\n`;
    });

    // Copy to clipboard and offer sharing
    Share.share({
      message: csv,
      title: `Daily Report - ${selectedDate}`,
    }).catch((err) => console.error(err));
  };

  const generatePrintHTML = (): string => {
    if (!report) return '';

    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Daily Report - ${selectedDate}</title>
          <style>
            body { font-family: 'Arial', sans-serif; margin: 20px; background: white; color: #333; }
            h1 { text-align: center; margin-bottom: 30px; font-size: 24px; }
            h2 { margin-top: 30px; margin-bottom: 15px; font-size: 16px; border-bottom: 2px solid #007AFF; padding-bottom: 5px; }
            .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
            .kpi-box { background: #f5f5f5; padding: 15px; border-left: 4px solid #007AFF; border-radius: 4px; }
            .kpi-label { font-size: 11px; color: #666; font-weight: bold; }
            .kpi-value { font-size: 20px; font-weight: bold; color: #007AFF; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            thead { background: #f5f5f5; }
            th { text-align: left; padding: 10px; border-bottom: 2px solid #ddd; font-weight: bold; font-size: 12px; }
            td { padding: 8px; border-bottom: 1px solid #eee; font-size: 11px; }
            tr:nth-child(even) { background: #fafafa; }
            .success { color: #28a745; font-weight: bold; }
            .primary { color: #007AFF; font-weight: bold; }
            .page-break { page-break-after: always; margin: 40px 0; }
            .footer { text-align: center; margin-top: 40px; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 15px; }
          </style>
        </head>
        <body>
          <h1>Daily Report</h1>
          <p style="text-align: center; margin-bottom: 30px; font-size: 14px;"><strong>Date:</strong> ${selectedDate}</p>

          <h2>Summary</h2>
          <div class="summary-grid">
            <div class="kpi-box">
              <div class="kpi-label">Gross Sales</div>
              <div class="kpi-value">KES ${report.summary.gross_sales.toFixed(0)}</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-label">Total Tips</div>
              <div class="kpi-value">KES ${report.summary.total_tips.toFixed(0)}</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-label">Net Revenue</div>
              <div class="kpi-value">KES ${report.summary.net_revenue.toFixed(0)}</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-label">Orders</div>
              <div class="kpi-value">${report.summary.total_orders}</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-label">Guests</div>
              <div class="kpi-value">${report.summary.total_guests}</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-label">Avg Check</div>
              <div class="kpi-value">KES ${report.summary.avg_check_size.toFixed(0)}</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-label">Items Sold</div>
              <div class="kpi-value">${report.summary.items_sold}</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-label">Success Rate</div>
              <div class="kpi-value">${report.summary.payment_success_rate.toFixed(0)}%</div>
            </div>
          </div>

          ${report.waiters.length > 0 ? `
            <h2>Waiter Performance</h2>
            <table>
              <thead>
                <tr>
                  <th>Waiter</th>
                  <th>Orders</th>
                  <th>Sales</th>
                  <th>Tips</th>
                  <th>Net Revenue</th>
                  <th>Avg Check</th>
                </tr>
              </thead>
              <tbody>
                ${report.waiters.map((w: WaiterSummary) => `
                  <tr>
                    <td>${w.waiter_name}</td>
                    <td>${w.order_count}</td>
                    <td class="success">KES ${w.total_sales.toFixed(0)}</td>
                    <td>KES ${w.total_tips.toFixed(0)}</td>
                    <td class="success">KES ${w.net_revenue.toFixed(0)}</td>
                    <td>KES ${w.avg_check_size.toFixed(0)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}

          ${report.categories.length > 0 ? `
            <h2>Category Breakdown</h2>
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Items</th>
                  <th>Quantity</th>
                  <th>Revenue</th>
                  <th>% of Sales</th>
                </tr>
              </thead>
              <tbody>
                ${report.categories.map((cat: CategorySummary) => `
                  <tr>
                    <td>${cat.category}</td>
                    <td>${cat.item_count}</td>
                    <td>${cat.quantity_sold}</td>
                    <td class="success">KES ${cat.total_revenue.toFixed(0)}</td>
                    <td class="primary">${cat.percentage_of_sales.toFixed(1)}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}

          <div class="footer">
            <p>Generated on ${format(new Date(), 'PPpp')}</p>
            <p>K19 POS System - Daily Report</p>
          </div>
        </body>
      </html>
    `;
  };

  const handlePrintReport = async () => {
    try {
      const html = generatePrintHTML();
      await Print.printAsync({
        html,
        printerUrl: undefined,
      });
    } catch (err) {
      Alert.alert('Error', 'Failed to print report');
      console.error(err);
    }
  };

  const handleSavePDF = async () => {
    try {
      const html = generatePrintHTML();
      
      // Generate PDF in temp location first
      const result = await Print.printToFileAsync({
        html,
        base64: false,
      });
      
      // Define the destination directory (Documents/K19Reports)
      const documentsDir = FileSystem.documentDirectory;
      const reportsDir = `${documentsDir}K19Reports/`;
      
      // Create directory if it doesn't exist
      const dirInfo = await FileSystem.getInfoAsync(reportsDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(reportsDir, { intermediates: true });
      }
      
      // Create filename with date
      const filename = `Daily_Report_${selectedDate}.pdf`;
      const destinationUri = `${reportsDir}${filename}`;
      
      // Move the file to the destination
      await FileSystem.moveAsync({
        from: result.uri,
        to: destinationUri,
      });
      
      Alert.alert(
        'Success', 
        `Report saved to:\n${destinationUri}\n\nWould you like to share it?`,
        [
          { text: 'No', style: 'cancel' },
          { 
            text: 'Share', 
            onPress: async () => {
              try {
                await Share.share({
                  url: destinationUri,
                  title: `Daily Report - ${selectedDate}`,
                });
              } catch (shareErr) {
                console.error('Share error:', shareErr);
              }
            }
          }
        ]
      );
    } catch (err) {
      Alert.alert('Error', 'Failed to save PDF');
      console.error(err);
    }
  };

  if (error) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: c.danger, fontSize: 16 }}>Error: {error}</Text>
          <Pressable
            onPress={() => fetchDailyReport(selectedDate)}
            style={{ marginTop: 16, padding: 12, backgroundColor: c.primary, borderRadius: 8 }}
          >
            <Text style={{ color: c.text, fontWeight: 'bold' }}>Retry</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={[styles.container, { backgroundColor: c.background }]}>
        <View style={[styles.header, { backgroundColor: c.card, borderBottomColor: c.border }]}>
          <View style={styles.headerTop}>
            <Pressable onPress={() => router.push('/(tabs)/profile')} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color={c.primary} />
            </Pressable>
            <Text style={[styles.title, { color: c.text }]}>Daily Report</Text>
            <View style={styles.backButtonPlaceholder} />
          </View>

          {/* Date Picker */}
          <View style={[styles.datePicker, { backgroundColor: c.input, borderColor: c.border }]}>
            <Pressable
              onPress={() => handleDateChange(-1)}
              style={[styles.dateBtn, { backgroundColor: c.primary }]}
            >
              <Text style={{ color: c.card, fontSize: 20 }}>←</Text>
            </Pressable>
            <Text style={[styles.dateText, { color: c.text }]}>{selectedDate}</Text>
            <Pressable
              onPress={() => handleDateChange(1)}
              style={[styles.dateBtn, { backgroundColor: c.primary }]}
            >
              <Text style={{ color: c.card, fontSize: 20 }}>→</Text>
            </Pressable>
          </View>

          {/* Export Button */}
          <View style={styles.buttonRow}>
            <Pressable
              onPress={handleExportCSV}
              disabled={!report || loading}
              style={[
                styles.exportBtn,
                styles.exportBtnHalf,
                { backgroundColor: report && !loading ? c.primary : c.muted },
              ]}
            >
              <Text style={{ color: c.card, fontWeight: 'bold', fontSize: 12 }}>CSV</Text>
            </Pressable>
            <Pressable
              onPress={handlePrintReport}
              disabled={!report || loading}
              style={[
                styles.exportBtn,
                styles.exportBtnHalf,
                { backgroundColor: report && !loading ? c.success : c.muted },
              ]}
            >
              <Text style={{ color: c.card, fontWeight: 'bold', fontSize: 12 }}>Print</Text>
            </Pressable>
            <Pressable
              onPress={handleSavePDF}
              disabled={!report || loading}
              style={[
                styles.exportBtn,
                styles.exportBtnHalf,
                { backgroundColor: report && !loading ? c.danger : c.muted },
              ]}
            >
              <Text style={{ color: c.card, fontWeight: 'bold', fontSize: 12 }}>PDF</Text>
            </Pressable>
          </View>
        </View>

        {/* Loading State */}
        {loading && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={c.primary} />
            <Text style={{ color: c.text, marginTop: 12 }}>Loading report...</Text>
          </View>
        )}

        {/* Content */}
        {!loading && report && (
          <ScrollView style={[{ flex: 1, backgroundColor: c.background }]} showsVerticalScrollIndicator={false}>
            {/* Summary KPIs */}
            <View style={styles.kpiGrid}>
              <KPICard
                label="Gross Sales"
                value={`KES ${report.summary.gross_sales.toFixed(0)}`}
                color={c.success}
                colors={c}
              />
              <KPICard
                label="Total Tips"
                value={`KES ${report.summary.total_tips.toFixed(0)}`}
                color={c.primary}
                colors={c}
              />
              <KPICard
                label="Avg Check"
                value={`KES ${report.summary.avg_check_size.toFixed(0)}`}
                color={c.primary}
                colors={c}
              />
              <KPICard
                label="Orders"
                value={report.summary.total_orders.toString()}
                color={c.primary}
                colors={c}
              />
              <KPICard
                label="Guests"
                value={report.summary.total_guests.toString()}
                color={c.primary}
                colors={c}
              />
              <KPICard
                label="Items Sold"
                value={report.summary.items_sold.toString()}
                color={c.primary}
                colors={c}
              />
              <KPICard
                label="Tables"
                value={report.summary.tables_occupied.toString()}
                color={c.primary}
                colors={c}
              />
              <KPICard
                label="Success Rate"
                value={`${report.summary.payment_success_rate.toFixed(0)}%`}
                color={c.success}
                colors={c}
              />
            </View>

            {/* Waiter Summary */}
            {report.waiters.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: c.text }]}>Waiter Summary</Text>
                <View style={[styles.table, { borderColor: c.border, backgroundColor: c.card }]}>
                  <View style={[styles.tableHeader, { backgroundColor: c.input, borderBottomColor: c.border, borderBottomWidth: 1 }]}>
                    <Text style={[styles.tableCell, styles.cellBold, { color: c.text, flex: 2 }]}>Waiter</Text>
                    <Text style={[styles.tableCell, styles.cellBold, { color: c.text, flex: 1 }]}>Orders</Text>
                    <Text style={[styles.tableCell, styles.cellBold, { color: c.text, flex: 1.5 }]}>Sales</Text>
                    <Text style={[styles.tableCell, styles.cellBold, { color: c.text, flex: 1.2 }]}>Avg</Text>
                  </View>
                  {report.waiters.map((waiter: WaiterSummary, idx: number) => (
                    <View key={idx} style={[styles.tableRow, { borderTopColor: c.border, backgroundColor: idx % 2 === 0 ? c.card : c.input }]}>
                      <Text style={[styles.tableCell, { color: c.text, flex: 2 }]}>{waiter.waiter_name}</Text>
                      <Text style={[styles.tableCell, { color: c.subtext, flex: 1 }]}>{waiter.order_count}</Text>
                      <Text style={[styles.tableCell, { color: c.success, flex: 1.5, fontWeight: 'bold' }]}>
                        {waiter.total_sales.toFixed(0)}
                      </Text>
                      <Text style={[styles.tableCell, { color: c.subtext, flex: 1.2 }]}>
                        {waiter.avg_check_size.toFixed(0)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Category Breakdown */}
            {report.categories.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: c.text }]}>Category Breakdown</Text>
                <View style={[styles.table, { borderColor: c.border, backgroundColor: c.card }]}>
                  <View style={[styles.tableHeader, { backgroundColor: c.input, borderBottomColor: c.border, borderBottomWidth: 1 }]}>
                    <Text style={[styles.tableCell, styles.cellBold, { color: c.text, flex: 2 }]}>Category</Text>
                    <Text style={[styles.tableCell, styles.cellBold, { color: c.text, flex: 1 }]}>Qty</Text>
                    <Text style={[styles.tableCell, styles.cellBold, { color: c.text, flex: 1.5 }]}>Revenue</Text>
                    <Text style={[styles.tableCell, styles.cellBold, { color: c.text, flex: 1 }]}>%</Text>
                  </View>
                  {report.categories.map((cat: CategorySummary, idx: number) => (
                    <View key={idx} style={[styles.tableRow, { borderTopColor: c.border, backgroundColor: idx % 2 === 0 ? c.card : c.input }]}>
                      <Text style={[styles.tableCell, { color: c.text, flex: 2 }]}>{cat.category}</Text>
                      <Text style={[styles.tableCell, { color: c.subtext, flex: 1 }]}>{cat.quantity_sold}</Text>
                      <Text style={[styles.tableCell, { color: c.success, flex: 1.5, fontWeight: 'bold' }]}>
                        {cat.total_revenue.toFixed(0)}
                      </Text>
                      <Text style={[styles.tableCell, { color: c.primary, flex: 1 }]}>
                        {cat.percentage_of_sales.toFixed(1)}%
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Orders List */}
            {report.orders.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: c.text }]}>Orders ({report.orders.length})</Text>
                <FlatList
                  scrollEnabled={false}
                  data={report.orders}
                  keyExtractor={(item, idx) => idx.toString()}
                  renderItem={({ item }) => (
                    <View style={[styles.orderCard, { backgroundColor: c.input, borderColor: c.border, borderLeftColor: c.primary, borderLeftWidth: 4 }]}>
                      <View style={[styles.orderRow, { borderBottomColor: c.border }]}>
                        <Text style={[styles.orderLabel, { color: c.subtext }]}>Guest</Text>
                        <Text style={[styles.orderValue, { color: c.text, fontWeight: '600' }]}>{item.guest_name}</Text>
                      </View>
                      <View style={[styles.orderRow, { borderBottomColor: c.border }]}>
                        <Text style={[styles.orderLabel, { color: c.subtext }]}>Table</Text>
                        <Text style={[styles.orderValue, { color: c.text }]}>{item.table_name}</Text>
                      </View>
                      <View style={[styles.orderRow, { borderBottomColor: c.border }]}>
                        <Text style={[styles.orderLabel, { color: c.subtext }]}>Waiter</Text>
                        <Text style={[styles.orderValue, { color: c.text }]}>{item.waiter_name || 'N/A'}</Text>
                      </View>
                      <View style={[styles.orderRow, { borderBottomColor: c.border }]}>
                        <Text style={[styles.orderLabel, { color: c.subtext }]}>Item</Text>
                        <Text style={[styles.orderValue, { color: c.text }]}>{item.menu_item_name}</Text>
                      </View>
                      <View style={[styles.orderRow, { borderBottomColor: c.border }]}>
                        <Text style={[styles.orderLabel, { color: c.subtext }]}>Qty × Price</Text>
                        <Text style={[styles.orderValue, { color: c.success, fontWeight: '600' }]}>
                          {item.quantity} × {item.price_snapshot.toFixed(0)} = {item.subtotal.toFixed(0)}
                        </Text>
                      </View>
                      <View style={[styles.orderRow, { borderBottomWidth: 0 }]}>
                        <Text style={[styles.orderLabel, { color: c.subtext }]}>Time</Text>
                        <Text style={[styles.orderValue, { color: c.subtext }]}>
                          {format(new Date(item.created_at), 'HH:mm:ss')}
                        </Text>
                      </View>
                    </View>
                  )}
                />
              </View>
            )}

            {/* Empty State */}
            {!report && (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ color: c.muted, fontSize: 16 }}>No data for selected date</Text>
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>
    </Screen>
  );
}

function KPICard({
  label,
  value,
  color,
  colors,
}: {
  label: string;
  value: string;
  color: string;
  colors: any;
}) {
  return (
    <View style={[styles.kpiCard, { backgroundColor: colors.input, borderColor: color }]}>
      <Text style={[styles.kpiLabel, { color: colors.subtext }]}>{label}</Text>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonPlaceholder: {
    width: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  dateBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  exportBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportBtnHalf: {
    flex: 1,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingTop: 16,
    gap: 12,
  },
  kpiCard: {
    width: '48%',
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  section: {
    marginHorizontal: 12,
    marginTop: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  table: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  tableCell: {
    fontSize: 12,
    paddingHorizontal: 4,
  },
  cellBold: {
    fontWeight: '600',
  },
  orderCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  orderLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  orderValue: {
    fontSize: 11,
    marginLeft: 8,
    flex: 1,
    textAlign: 'right',
  },
});
