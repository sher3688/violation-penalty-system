import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Printer } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { selectNoticePhotoSlots } from "@shared/noticePhotoSlots";
import { formatNoticeRegulationBasis } from "@shared/noticePrint";

export default function PrintNoticePage() {
  const [, params] = useRoute("/print/:id");
  const [, setLocation] = useLocation();
  const isDevelopmentPreview =
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    window.location.pathname === "/print-preview";
  const caseId = Number(params?.id);
  const isSinglePhotoPreview =
    isDevelopmentPreview && new URLSearchParams(window.location.search).get("photos") === "1";
  const caseQuery = trpc.cases.get.useQuery(
    { id: Number.isInteger(caseId) && caseId > 0 ? caseId : 1 },
    { enabled: !isDevelopmentPreview && Number.isInteger(caseId) && caseId > 0 }
  );

  if (!isDevelopmentPreview && caseQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <Skeleton className="h-[297mm] w-[210mm] max-w-[92vw]" />
      </div>
    );
  }

  const violationCase = isDevelopmentPreview
    ? {
        ...developmentPreviewNotice,
        photos: isSinglePhotoPreview ? developmentPreviewNotice.photos.slice(0, 1) : developmentPreviewNotice.photos,
      }
    : caseQuery.data;
  if (!violationCase) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 p-6">
        <p className="text-slate-600">找不到可列印的案件資料。</p>
        <Button onClick={() => setLocation("/")}>返回總覽</Button>
      </div>
    );
  }

  return (
    <div className="print-shell min-h-screen bg-slate-200 px-4 py-7 text-slate-950 md:px-8">
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        @media print {
          html, body, #root { width: 210mm !important; min-height: 297mm !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
          .print-shell { width: 210mm !important; min-height: 297mm !important; padding: 0 !important; background: #fff !important; }
          .print-controls { display: none !important; }
          .a4-notice { box-shadow: none !important; width: 210mm !important; height: 297mm !important; margin: 0 !important; page-break-after: avoid !important; }
          .notice-copy { break-inside: avoid !important; page-break-inside: avoid !important; }
        }
      `}</style>

      <div className="print-controls mx-auto mb-5 flex w-[210mm] max-w-full flex-wrap items-center justify-between gap-3">
        <Button variant="outline" className="bg-white" onClick={() => setLocation(`/cases/${caseId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />返回案件明細
        </Button>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-600 sm:inline">請於列印設定中選擇 A4、直向、邊界「無」。</span>
          <Button className="bg-[#14332f] text-white hover:bg-[#0c2723]" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />列印通知單
          </Button>
        </div>
      </div>

      <article className="a4-notice mx-auto flex h-[297mm] w-[210mm] max-w-full flex-col overflow-hidden bg-white shadow-2xl shadow-slate-500/20" aria-label="A4 違規通知單">
        <NoticeCopy violationCase={violationCase} copyLabel="住戶收執聯" isDevelopmentPreview={isDevelopmentPreview} />
        <div className="print-cut relative h-[4mm] shrink-0 bg-white" aria-label="裁切線">
          <div className="absolute left-0 right-0 top-1/2 border-t-2 border-dashed border-slate-800" />
        </div>
        <NoticeCopy violationCase={violationCase} copyLabel="留存聯" isDevelopmentPreview={isDevelopmentPreview} />
      </article>
    </div>
  );
}

type PrintPhoto = { id: number; storageKey: string; originalName: string; preview?: boolean; previewUrl?: string };
type NoticeCase = {
  householdNo: string;
  occurredAt: Date | string | number;
  violationType: string;
  penaltyAmount: number;
  regulationBasis?: string | null;
  photos: PrintPhoto[];
};

const developmentPreviewNotice: NoticeCase = {
  householdNo: "A3-3F",
  occurredAt: "2026-07-18T10:27:00+08:00",
  violationType: "公共空間堆置雜物",
  penaltyAmount: 500,
  regulationBasis: "住戶規約",
  photos: [
    {
      id: -1,
      storageKey: "development-preview-photo-1",
      originalName: "開發預覽橫式建築環境照片",
      preview: true,
      previewUrl: "/manus-storage/notice-test-landscape_1b200378.jpg",
    },
    {
      id: -2,
      storageKey: "development-preview-photo-2",
      originalName: "開發預覽直式建築環境照片",
      preview: true,
      previewUrl: "/manus-storage/notice-test-portrait_b4cef3f7.jpg",
    },
  ],
};

function NoticeCopy({
  violationCase,
  copyLabel,
  isDevelopmentPreview,
}: {
  violationCase: NoticeCase;
  copyLabel: "住戶收執聯" | "留存聯";
  isDevelopmentPreview: boolean;
}) {
  const { leftPhoto, rightPhoto } = selectNoticePhotoSlots(violationCase.photos);

  return (
    <section className="notice-copy relative box-border h-[146.5mm] shrink-0 overflow-hidden bg-white px-[12mm] py-[8.5mm]">
      <h1 className="absolute left-[78mm] top-[7.3mm] z-10 whitespace-nowrap text-[18.5pt] font-medium tracking-[0.04em] text-[#E5005C]">
        違規通知單
      </h1>

      <div className="grid h-full grid-cols-[1.42fr_1fr] gap-[4.8mm] pb-[17mm]">
        <div className="flex h-full min-w-0 flex-col pt-[2mm]">
          <div className="text-[12pt] leading-[1.3] tracking-[0.04em] text-slate-950">
            <p>戶號：<span className="font-medium">{violationCase.householdNo}</span></p>
            <p>日期：<span className="font-medium">{formatNoticeDate(violationCase.occurredAt)}</span></p>
            <p className="mt-[5.2mm]">違規類型：<span className="font-medium">{violationCase.violationType}</span></p>
          </div>

          <p className="mt-[2.7mm] whitespace-nowrap text-[13.5pt] leading-none tracking-[0.03em] text-[#E5005C]">
            於次月加收清潔費&nbsp; {formatPenaltyAmount(violationCase.penaltyAmount)}
          </p>
          <PhotoFrame
            className="mt-auto h-[79mm]"
            photo={leftPhoto}
            previewIndex={0}
            isDevelopmentPreview={isDevelopmentPreview}
            orientation="landscape"
          />
        </div>

        <div className="flex h-full min-w-0 flex-col pt-[5mm]">
          {rightPhoto ? (
            <PhotoFrame
              className="mt-auto h-[105mm]"
              photo={rightPhoto}
              previewIndex={1}
              isDevelopmentPreview={isDevelopmentPreview}
              orientation="portrait"
            />
          ) : null}
        </div>
              </div>

      <p className="absolute bottom-[15mm] left-[12mm] right-[92mm] break-words text-[13.2pt] leading-[1.15] tracking-[0.02em] text-slate-700">
        法源依據：<span className="font-medium">{formatNoticeRegulationBasis(violationCase.regulationBasis)}</span>
      </p>

      <footer className="absolute bottom-[6.2mm] left-[12mm] right-[12mm] flex items-end justify-between gap-[7mm]">

        <p className="max-w-[151mm] text-[12.8pt] leading-[1.35] tracking-[0.02em] text-[#E5005C]">
          本單據請妥善保存，若有異議請於下一次委員會議持單據到現場申訴。
        </p>
        <p className="shrink-0 whitespace-nowrap text-[12.8pt] text-slate-950">{copyLabel}</p>
      </footer>
    </section>
  );
}

function PhotoFrame({
  className,
  photo,
  previewIndex,
  isDevelopmentPreview,
  orientation,
}: {
  className: string;
  photo?: PrintPhoto;
  previewIndex: number;
  isDevelopmentPreview: boolean;
  orientation: "landscape" | "portrait";
}) {
  return (
    <figure className={`overflow-hidden bg-[#A7A7AA] ${className}`} aria-label={orientation === "landscape" ? "橫式現場照片" : "直式現場照片"}>
      {photo ? (
        isDevelopmentPreview && photo.preview ? (
          <PreviewPhoto src={photo.previewUrl} alt={photo.originalName || "開發預覽現場照片"} />
        ) : (
          <img className="h-full w-full object-cover" src={`/api/files/${photo.storageKey}`} alt={photo.originalName || "違規現場照片"} />
        )
      ) : (
        <PhotoPlaceholder />
      )}
    </figure>
  );
}

function PreviewPhoto({ src, alt }: { src?: string; alt: string }) {
  if (!src) return <PhotoPlaceholder />;
  return <img className="h-full w-full object-cover" src={src} alt={alt} />;
}

function PhotoPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#A7A7AA] text-[16pt] font-light tracking-[0.04em] text-white">
      PHOTO
    </div>
  );
}

function formatNoticeDate(value: Date | string | number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function formatPenaltyAmount(value: number) {
  return `${Math.max(0, Math.trunc(value || 0)).toLocaleString("zh-TW")}元整`;
}
