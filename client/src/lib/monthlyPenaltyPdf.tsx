import React from "react";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatCurrency, formatDate, getCaseStatusMeta } from "@/lib/caseUtils";
import { formatExportMonthTitle, summarizeMonthlyPenalties } from "@shared/monthlyPenaltyExport";

const FONT_FAMILY = "MonthlyPenaltyPdfCjk";
const FONT_SOURCE = "/manus-storage/NotoSansCJKtc-Regular_a2853409.otf";
let registeredFontSource: string | null = null;

export type MonthlyPenaltyPdfCase = {
  id: number;
  noticeNo: string;
  householdNo: string;
  violationType: string;
  location: string;
  occurredAt: Date | string | number;
  penaltyAmount: number | null;
  status: string;
};

type MonthlyPenaltyPdfDocumentProps = {
  month: string;
  cases: MonthlyPenaltyPdfCase[];
  generatedAt: Date;
};

export function registerMonthlyPenaltyPdfFont(source = FONT_SOURCE) {
  if (registeredFontSource === source) return;

  Font.register({
    family: FONT_FAMILY,
    fonts: [
      { src: source, fontWeight: 400 },
      { src: source, fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback(word => [word]);
  registeredFontSource = source;
}

export function MonthlyPenaltyPdfDocument({ month, cases, generatedAt }: MonthlyPenaltyPdfDocumentProps) {
  const summary = summarizeMonthlyPenalties(cases);
  const firstPageRows = cases.slice(0, 6);
  const followingPages = chunk(cases.slice(6), 7);
  const pages = cases.length === 0 ? [[]] : [firstPageRows, ...followingPages];

  return (
    <Document title={formatExportMonthTitle(month)} author="社區違規開罰管理系統" subject="每月罰單紀錄">
      {pages.map((pageCases, index) => (
        <Page key={index} size="A4" style={styles.page}>
          {index === 0 ? (
            <>
              <View style={styles.header}>
                <View>
                  <Text style={styles.kicker}>COMMUNITY OFFICE</Text>
                  <Text style={styles.title}>{formatExportMonthTitle(month)}</Text>
                  <Text style={styles.subtitle}>社區違規開罰管理系統｜依違規日期彙整</Text>
                </View>
                <Text style={styles.headerMeta}>匯出日期：{formatDate(generatedAt)}{"\n"}報表月份：{month}</Text>
              </View>
              <View style={styles.summary}>
                <SummaryCell label="罰單筆數" value={`${summary.caseCount} 筆`} />
                <SummaryCell label="開立金額" value={formatCurrency(summary.totalAmount)} />
                <SummaryCell label="已繳款" value={`${summary.paidCount} 筆`} />
                <SummaryCell label="待處理" value={`${summary.outstandingCount} 筆`} isLast />
              </View>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>罰單明細</Text>
                <Text style={styles.sectionCount}>共 {cases.length} 筆</Text>
              </View>
            </>
          ) : (
            <View style={styles.continuedHeader}>
              <Text style={styles.continuedTitle}>{formatExportMonthTitle(month)}</Text>
              <Text style={styles.sectionCount}>明細續頁</Text>
            </View>
          )}

          {cases.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>本月沒有已開立的罰單紀錄</Text>
              <Text style={styles.emptyHint}>此 PDF 已保留月份、匯出日期與零筆統計結果。</Text>
            </View>
          ) : (
            <View style={styles.recordList}>
              {pageCases.map(violationCase => <PenaltyRecord key={violationCase.id} violationCase={violationCase} />)}
            </View>
          )}

          <View style={styles.footer} fixed>
            <Text>本報表為系統依違規日期自動彙整。</Text>
            <Text render={({ pageNumber, totalPages }) => `罰單紀錄 ${month}｜第 ${pageNumber} / ${totalPages} 頁`} />
          </View>
        </Page>
      ))}
    </Document>
  );
}

function SummaryCell({ label, value, isLast = false }: { label: string; value: string; isLast?: boolean }) {
  return (
    <View style={isLast ? [styles.summaryCell, styles.summaryCellLast] : styles.summaryCell}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function PenaltyRecord({ violationCase }: { violationCase: MonthlyPenaltyPdfCase }) {
  const status = getCaseStatusMeta(violationCase.status);

  return (
    <View style={styles.recordCard} wrap={false}>
      <View style={styles.recordHeader}>
        <Text style={styles.recordNotice}>通知單　{violationCase.noticeNo}</Text>
        <Text style={styles.recordStatus}>{status.label}</Text>
      </View>
      <View style={styles.recordMetaRow}>
        <Text style={styles.recordMeta}>戶號　{violationCase.householdNo}</Text>
        <Text style={styles.recordMeta}>違規日期　{formatDate(violationCase.occurredAt)}</Text>
        <Text style={[styles.recordMeta, styles.recordAmount]}>金額　{formatCurrency(violationCase.penaltyAmount)}</Text>
      </View>
      <Text style={styles.recordDetail}>違規類型　{violationCase.violationType}</Text>
      <Text style={styles.recordLocation}>地點　　　{violationCase.location}</Text>
    </View>
  );
}

function chunk<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 38,
    paddingRight: 38,
    paddingBottom: 48,
    paddingLeft: 38,
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    color: "#17202A",
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1.5,
    borderBottomColor: "#14332F",
    paddingBottom: 15,
  },
  kicker: {
    color: "#146C5A",
    fontSize: 8,
    letterSpacing: 1.4,
  },
  title: {
    marginTop: 7,
    color: "#111827",
    fontSize: 19,
    fontWeight: 700,
  },
  subtitle: {
    marginTop: 6,
    color: "#64748B",
    fontSize: 8.5,
  },
  headerMeta: {
    color: "#64748B",
    fontSize: 8,
    lineHeight: 1.6,
    textAlign: "right",
  },
  summary: {
    flexDirection: "row",
    marginTop: 18,
    marginBottom: 18,
    borderWidth: 0.8,
    borderColor: "#CBD5E1",
    borderRadius: 4,
    backgroundColor: "#F8FAFC",
  },
  summaryCell: {
    flexGrow: 1,
    flexBasis: 0,
    alignItems: "center",
    borderRightWidth: 0.8,
    borderRightColor: "#CBD5E1",
    paddingVertical: 10,
  },
  summaryCellLast: { borderRightWidth: 0 },
  summaryLabel: { color: "#64748B", fontSize: 8 },
  summaryValue: { marginTop: 3, color: "#111827", fontSize: 12, fontWeight: 700 },
  sectionTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: { color: "#111827", fontSize: 12, fontWeight: 700 },
  sectionCount: { color: "#64748B", fontSize: 8 },
  continuedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1.5,
    borderBottomColor: "#14332F",
    paddingBottom: 12,
    marginBottom: 12,
  },
  continuedTitle: { color: "#111827", fontSize: 13, fontWeight: 700 },
  recordList: { marginTop: 0 },
  recordCard: {
    borderWidth: 0.8,
    borderColor: "#CBD5E1",
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    marginBottom: 7,
    padding: 8,
  },
  recordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.6,
    borderBottomColor: "#E2E8F0",
    paddingBottom: 5,
  },
  recordNotice: { color: "#14332F", fontSize: 9, fontWeight: 700 },
  recordStatus: { color: "#146C5A", fontSize: 8, fontWeight: 700 },
  recordMetaRow: { flexDirection: "row", marginTop: 6 },
  recordMeta: { flexGrow: 1, flexBasis: 0, color: "#334155", fontSize: 7.5 },
  recordAmount: { textAlign: "right" },
  recordDetail: { marginTop: 5, color: "#17202A", fontSize: 8.2, lineHeight: 1.35 },
  recordLocation: { marginTop: 3, color: "#64748B", fontSize: 7.7, lineHeight: 1.3 },
  emptyState: {
    alignItems: "center",
    borderWidth: 0.8,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
    paddingVertical: 70,
  },
  emptyTitle: { color: "#334155", fontSize: 12, fontWeight: 700 },
  emptyHint: { marginTop: 6, color: "#64748B", fontSize: 8.5 },
  footer: {
    position: "absolute",
    left: 38,
    right: 38,
    bottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.6,
    borderTopColor: "#CBD5E1",
    paddingTop: 7,
    color: "#64748B",
    fontSize: 7.5,
  },
});
