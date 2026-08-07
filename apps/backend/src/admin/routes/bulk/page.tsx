import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ArrowDownTray, CloudArrowUp, XMarkMini } from "@medusajs/icons";
import { Badge, Button, Container, Table, Text, toast } from "@medusajs/ui";
import { useRef, useState } from "react";

/**
 * The shop's daily tool: upload a spreadsheet and a zip of photos, see exactly
 * what will change, then commit it.
 *
 * Two rules shape this screen. Nothing is written until the shop presses the
 * button — the preview is a dry run against the real catalogue. And the errors
 * are the product: every one names the row as Excel numbers it and says what
 * is wrong in plain Bulgarian, because the person reading it is holding a
 * spreadsheet, not a stack trace.
 */

interface Issue {
  row: number;
  column?: string;
  message: string;
}

interface Counts {
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  variantsOrphaned: number;
}

interface ReviewResult {
  issues: Issue[];
  counts: Counts | null;
  orphanedVariants: { sku: string; productSku: string }[];
  productCount: number;
  photoCount: number;
  canImport: boolean;
  message?: string;
  /** Only on the photos-only path: which articles get new photography. */
  articles?: { sku: string; title: string; colors: string[]; photoCount: number }[];
  total?: number;
}

/**
 * Fills in what a given endpoint does not send.
 *
 * The two review endpoints answer with different shapes: a spreadsheet review
 * carries counts and orphaned variants, a photos-only review carries neither.
 * Reading `orphanedVariants.length` off the second one threw, and a thrown
 * render in the admin is a blank screen — so uploading a zip of photographs,
 * which is the commonest thing this screen is asked to do, broke it.
 *
 * Normalising here rather than at each use, because the next field added to one
 * endpoint and not the other would land exactly the same way.
 */
const normalise = (data: Partial<ReviewResult>): ReviewResult => ({
  ...data,
  issues: data.issues ?? [],
  counts: data.counts ?? null,
  orphanedVariants: data.orphanedVariants ?? [],
  productCount: data.productCount ?? 0,
  photoCount: data.photoCount ?? 0,
  canImport: data.canImport ?? false,
});

/** Long lists are cut off here; the count is always reported in full. */
const LIST_LIMIT = 25;

/** An attached file, with a way to take it off again. */
const Attached = ({
  label,
  empty,
  file,
  onClear,
}: {
  label: string;
  empty: string;
  file: File | null;
  onClear: () => void;
}) => (
  <div className="flex items-center gap-1">
    <Badge color={file ? "green" : "grey"}>{file ? `${label}: ${file.name}` : empty}</Badge>
    {file && (
      <Button
        variant="transparent"
        size="small"
        aria-label={`Махни: ${file.name}`}
        onClick={onClear}
      >
        <XMarkMini />
      </Button>
    )}
  </div>
);

const BulkPage = () => {
  const [sheet, setSheet] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File | null>(null);
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [busy, setBusy] = useState<"validate" | "import" | "export" | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /* The input keeps the path of whatever was chosen last, and picking the same
     path again fires no change event. Which is precisely the loop this screen
     invites: export, fix one cell in Excel, save over it, pick it again — and
     the screen would sit there having noticed nothing, with no error to
     explain itself. Clearing after every pick keeps the same file pickable. */
  const clearInput = () => {
    if (inputRef.current) inputRef.current.value = "";
  };

  /* Files are sorted by extension rather than by which input they landed in.
     Someone dropping two files should not have to think about order. */
  const accept = (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (/\.xlsx$/i.test(file.name)) setSheet(file);
      else if (/\.zip$/i.test(file.name)) setPhotos(file);
      else toast.error(`"${file.name}" не е .xlsx или .zip и беше пропуснат`);
    }
    setReview(null);
    clearInput();
  };

  /* Photos with no spreadsheet is its own path, not a special case of the
     other one. Replacing a photograph should not require retyping a price. */
  const photosOnly = !sheet && photos !== null;

  /**
   * Downloads the catalogue.
   *
   * Fetched rather than opened in a tab. Building it reads every variant's
   * stock, which takes a few seconds on a shop this size — long enough that a
   * tab opening onto nothing reads as a broken button, and gets pressed again.
   * And when it fails, a new tab shows the shop raw JSON; here the same failure
   * is a sentence in Bulgarian, next to the button they just pressed.
   */
  const exportCatalogue = async () => {
    setBusy("export");
    try {
      const response = await fetch("/admin/bulk/export", { credentials: "include" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast.error(data.message ?? "Каталогът не можа да бъде свален.");
        return;
      }

      /* The server names the file with today's date, and that name is the
         point: the shop ends up with several of these and the useful question
         is always which one is from before the prices changed. */
      const disposition = response.headers.get("content-disposition") ?? "";
      const named = /filename="([^"]+)"/.exec(disposition)?.[1];

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = named ?? "red-point.xlsx";
      link.click();
      URL.revokeObjectURL(url);

      toast.success("Каталогът е свален.");
    } catch {
      toast.error("Връзката със сървъра прекъсна. Опитайте отново.");
    } finally {
      setBusy(null);
    }
  };

  const send = async (path: "validate" | "import") => {
    if (!sheet && !photosOnly) return;
    setBusy(path);

    const body = new FormData();
    if (sheet) body.append("sheet", sheet);
    if (photos) body.append("photos", photos);

    const url = photosOnly
      ? `/admin/bulk/photos${path === "validate" ? "?dry=1" : ""}`
      : `/admin/bulk/${path}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        body,
        credentials: "include",
      });
      const data = (await response.json()) as ReviewResult;

      if (!response.ok) {
        toast.error(data.message ?? "Нещо се обърка.");
        if (data.issues) setReview(normalise({ ...data, canImport: false }));
        return;
      }

      if (path === "import") {
        const counts = data.counts;
        toast.success(
          counts
            ? `Готово: ${counts.productsCreated} нови и ${counts.productsUpdated} обновени артикула`
            : data.articles
              ? `Готово: снимките на ${data.articles.length} артикула са обновени`
              : "Импортът приключи",
        );
        setReview(null);
        setSheet(null);
        setPhotos(null);
        clearInput();
        return;
      }

      setReview(normalise(data));
    } catch (error) {
      toast.error("Връзката със сървъра прекъсна. Опитайте отново.");
      console.error(error);
    } finally {
      setBusy(null);
    }
  };

  const rowIssues = review?.issues.filter((issue) => issue.row > 0) ?? [];
  const fileIssues = review?.issues.filter((issue) => issue.row === 0) ?? [];

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-2 px-6 py-4">
        {/* A plain h1 rather than @medusajs/ui's Heading. In 4.2.0 its props
            type resolves without `children`, so passing any text to it fails to
            compile — every other component from that package is fine. Using it
            would mean switching off type checking for this whole screen. */}
        <h1 className="txt-large-plus text-ui-fg-base">Качване на артикули</h1>
        <Text size="small" className="text-ui-fg-subtle">
          Качете таблицата с артикулите и архива със снимките. Нищо не се
          записва, преди да натиснете „Импортирай“.
        </Text>
      </div>

      <div className="px-6 py-4">
        {/* A label, not a div with an onClick. The click handler worked with a
            mouse and left the file picker unreachable by keyboard entirely:
            the div could not be focused and the input was `hidden`, which
            removes it from the tab order too. A label opens its own input on
            click and on Enter, with no handler at all, and the input keeps its
            place in the tab order while staying out of sight. */}
        <label
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            accept(event.dataTransfer.files);
          }}
          /* The focus ring is an outline in currentColor rather than a themed
             ring utility, so it is drawn whether or not the admin's Tailwind
             build happens to generate that colour for this file. A focus
             indicator that silently does not render is the same as none. */
          className={`flex cursor-pointer flex-col items-center gap-2 border border-dashed p-8 text-center focus-within:border-ui-fg-base focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 ${
            dragging ? "border-ui-fg-base bg-ui-bg-base-hover" : "border-ui-border-base"
          }`}
        >
          <CloudArrowUp />
          <Text weight="plus">Пуснете файловете тук или кликнете, за да изберете</Text>
          <Text size="small" className="text-ui-fg-subtle">
            .xlsx с артикулите, или само .zip със снимките за вече съществуващи артикули
          </Text>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".xlsx,.zip"
            aria-label="Изберете таблица .xlsx и/или архив .zip със снимки"
            className="sr-only"
            onChange={(event) => accept(event.target.files)}
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/* Attached files can be taken off again. Without this, a zip dropped
              by mistake could not be removed at all — the only way out was to
              reload the page, and the shop had no reason to guess that. */}
          <Attached
            label="Таблица"
            empty="Няма таблица"
            file={sheet}
            onClear={() => {
              setSheet(null);
              setReview(null);
            }}
          />
          <Attached
            label="Снимки"
            empty="Няма архив със снимки"
            file={photos}
            onClear={() => {
              setPhotos(null);
              setReview(null);
            }}
          />

          <div className="ml-auto flex gap-2">
            {/* The catalogue first: it is the one somebody reaches for daily,
                and the template is what they need once. */}
            <Button
              variant="secondary"
              disabled={busy !== null}
              isLoading={busy === "export"}
              onClick={exportCatalogue}
            >
              <ArrowDownTray />
              Свали каталога
            </Button>
            <Button
              variant="transparent"
              disabled={busy !== null}
              onClick={() => window.open("/admin/bulk/template", "_blank")}
            >
              Празен шаблон
            </Button>
            <Button
              variant="secondary"
              disabled={(!sheet && !photosOnly) || busy !== null}
              isLoading={busy === "validate"}
              onClick={() => send("validate")}
            >
              Провери
            </Button>
            <Button
              variant="primary"
              disabled={!review?.canImport || busy !== null}
              isLoading={busy === "import"}
              onClick={() => send("import")}
            >
              Импортирай
            </Button>
          </div>
        </div>
      </div>

      {review && (
        <div className="flex flex-col gap-4 px-6 py-4">
          {review.articles ? (
            <div className="flex flex-col gap-2">
              <Text weight="plus">
                {review.articles.length > 0
                  ? `Готови за качване: ${review.total} снимки на ${review.articles.length} артикула`
                  : "Нито една снимка не съответства на артикул в магазина."}
              </Text>
              {review.articles.slice(0, LIST_LIMIT).map((article) => (
                <Text key={article.sku} size="small" className="text-ui-fg-subtle">
                  {article.sku} · {article.title} — {article.colors.join(", ")} ({article.photoCount} снимки)
                </Text>
              ))}
              {review.articles.length > LIST_LIMIT && (
                <Text size="small" className="text-ui-fg-subtle">
                  … и още {review.articles.length - LIST_LIMIT} артикула
                </Text>
              )}
              <Text size="small" className="text-ui-fg-subtle">
                Старите снимки на тези артикули ще бъдат заменени.
              </Text>
            </div>
          ) : review.canImport && review.counts ? (
            <div className="flex flex-col gap-2">
              <Text weight="plus">Проверката мина. Ще се направи следното:</Text>
              <div className="flex flex-wrap gap-2">
                <Badge color="green">{review.counts.productsCreated} нови артикула</Badge>
                <Badge color="blue">{review.counts.productsUpdated} обновени</Badge>
                <Badge color="grey">{review.counts.variantsCreated} нови комбинации</Badge>
                <Badge color="grey">{review.photoCount} снимки</Badge>
              </div>
            </div>
          ) : (
            <Text weight="plus" className="text-ui-fg-error">
              Таблицата има {rowIssues.length}{" "}
              {rowIssues.length === 1 ? "грешка" : "грешки"}. Поправете ги и
              качете файла отново.
            </Text>
          )}

          {rowIssues.length > 0 && (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell className="w-24">Ред</Table.HeaderCell>
                  <Table.HeaderCell className="w-40">Колона</Table.HeaderCell>
                  <Table.HeaderCell>Какво е сбъркано</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {/* Cut off, because a file with the columns in the wrong order
                    produces an error on every row, and eight hundred rows of
                    the same sentence buries the one line that says which
                    column. The count above is always the true one. */}
                {rowIssues.slice(0, LIST_LIMIT).map((issue, index) => (
                  <Table.Row key={`${issue.row}-${index}`}>
                    <Table.Cell>{issue.row}</Table.Cell>
                    <Table.Cell>{issue.column ?? "—"}</Table.Cell>
                    <Table.Cell>{issue.message}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}

          {rowIssues.length > LIST_LIMIT && (
            <Text size="small" className="text-ui-fg-subtle">
              Показани са първите {LIST_LIMIT} от {rowIssues.length}. Поправете
              тези и проверете пак — обикновено останалите са същата грешка.
            </Text>
          )}

          {/* Photo problems do not block the import — a missing photo is worth
              knowing about, but it is not a reason to refuse a stock update. */}
          {fileIssues.length > 0 && (
            <div className="flex flex-col gap-1">
              <Text weight="plus">Забележки за снимките</Text>
              {fileIssues.slice(0, LIST_LIMIT).map((issue, index) => (
                <Text key={index} size="small" className="text-ui-fg-subtle">
                  {issue.message}
                </Text>
              ))}
              {fileIssues.length > LIST_LIMIT && (
                <Text size="small" className="text-ui-fg-subtle">
                  … и още {fileIssues.length - LIST_LIMIT}
                </Text>
              )}
            </div>
          )}

          {review.orphanedVariants.length > 0 && (
            <div className="flex flex-col gap-1">
              <Text weight="plus">
                Тези комбинации ги има в магазина, но липсват в таблицата
              </Text>
              <Text size="small" className="text-ui-fg-subtle">
                Няма да бъдат изтрити. Ако наистина ги спирате, направете го
                ръчно от списъка с артикули.
              </Text>
              {review.orphanedVariants.slice(0, LIST_LIMIT).map((variant) => (
                <Text key={variant.sku} size="small" className="text-ui-fg-subtle">
                  {variant.sku}
                </Text>
              ))}
              {review.orphanedVariants.length > LIST_LIMIT && (
                <Text size="small" className="text-ui-fg-subtle">
                  … и още {review.orphanedVariants.length - LIST_LIMIT}
                </Text>
              )}
            </div>
          )}
        </div>
      )}
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Качване на артикули",
  icon: CloudArrowUp,
});

export default BulkPage;
