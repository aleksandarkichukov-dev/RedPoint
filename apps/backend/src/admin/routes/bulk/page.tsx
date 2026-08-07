import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ArrowDownTray, CloudArrowUp } from "@medusajs/icons";
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

const BulkPage = () => {
  const [sheet, setSheet] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File | null>(null);
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [busy, setBusy] = useState<"validate" | "import" | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
  };

  /* Photos with no spreadsheet is its own path, not a special case of the
     other one. Replacing a photograph should not require retyping a price. */
  const photosOnly = !sheet && photos !== null;

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
        if (data.issues) setReview({ ...data, canImport: false });
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
        return;
      }

      setReview(data);
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
        <div
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
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center gap-2 border border-dashed p-8 text-center ${
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
            className="hidden"
            onChange={(event) => accept(event.target.files)}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Badge color={sheet ? "green" : "grey"}>
            {sheet ? `Таблица: ${sheet.name}` : "Няма таблица"}
          </Badge>
          <Badge color={photos ? "green" : "grey"}>
            {photos ? `Снимки: ${photos.name}` : "Няма архив със снимки"}
          </Badge>

          <div className="ml-auto flex gap-2">
            {/* The catalogue first: it is the one somebody reaches for daily,
                and the template is what they need once. */}
            <Button
              variant="secondary"
              onClick={() => window.open("/admin/bulk/export", "_blank")}
            >
              <ArrowDownTray />
              Свали каталога
            </Button>
            <Button
              variant="transparent"
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
              {review.articles.map((article) => (
                <Text key={article.sku} size="small" className="text-ui-fg-subtle">
                  {article.sku} · {article.title} — {article.colors.join(", ")} ({article.photoCount} снимки)
                </Text>
              ))}
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
                {rowIssues.map((issue, index) => (
                  <Table.Row key={`${issue.row}-${index}`}>
                    <Table.Cell>{issue.row}</Table.Cell>
                    <Table.Cell>{issue.column ?? "—"}</Table.Cell>
                    <Table.Cell>{issue.message}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}

          {/* Photo problems do not block the import — a missing photo is worth
              knowing about, but it is not a reason to refuse a stock update. */}
          {fileIssues.length > 0 && (
            <div className="flex flex-col gap-1">
              <Text weight="plus">Забележки за снимките</Text>
              {fileIssues.map((issue, index) => (
                <Text key={index} size="small" className="text-ui-fg-subtle">
                  {issue.message}
                </Text>
              ))}
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
              {review.orphanedVariants.map((variant) => (
                <Text key={variant.sku} size="small" className="text-ui-fg-subtle">
                  {variant.sku}
                </Text>
              ))}
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
