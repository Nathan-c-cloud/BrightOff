/**
 * Tests unitaires — DropZone
 *
 * Couvre :
 *   - Rendu de l'état idle
 *   - Clic sur la zone → ouvre le file picker (input.click)
 *   - Dépôt d'un PDF valide → callback onFile appelé
 *   - Fichier > 5 MB → message d'erreur
 *   - Fichier .txt → message d'erreur extension
 *   - Fichier MIME invalide → message d'erreur
 *   - validateFile() : tests unitaires directs
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DropZone, validateFile } from "./DropZone";

// ---------------------------------------------------------------------------
// Factories helpers
// ---------------------------------------------------------------------------

function makePdfFile(
  name = "cv.pdf",
  size = 1024
): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type: "application/pdf" });
}

function makeDocxFile(
  name = "cv.docx",
  size = 1024
): File {
  const content = new Uint8Array(size);
  return new File([content], name, {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

function makeTxtFile(name = "cv.txt", size = 512): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type: "text/plain" });
}

/** Crée un fichier PDF > 5 MB */
function makeOversizedFile(): File {
  const size = 5 * 1024 * 1024 + 1; // 5 MB + 1 octet
  const content = new Uint8Array(size);
  return new File([content], "big-cv.pdf", { type: "application/pdf" });
}

// ---------------------------------------------------------------------------
// Props par défaut pour tous les tests
// ---------------------------------------------------------------------------

function defaultProps() {
  return {
    state: "idle" as const,
    uploadProgress: 0,
    fileName: null,
    errorMessage: null,
    onFile: vi.fn(),
    onRetry: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Mock de HTMLInputElement.click
// ---------------------------------------------------------------------------

// jsdom ne déclenche pas réellement le sélecteur de fichiers natif — on vérifie
// simplement que .click() est appelé sur l'input
beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// validateFile — tests unitaires directs
// ---------------------------------------------------------------------------

describe("validateFile", () => {
  it("returns_null_for_valid_pdf", () => {
    expect(validateFile(makePdfFile())).toBeNull();
  });

  it("returns_null_for_valid_docx", () => {
    expect(validateFile(makeDocxFile())).toBeNull();
  });

  it("returns_error_for_file_over_5mb", () => {
    const error = validateFile(makeOversizedFile());
    expect(error).toMatch(/5 MB/i);
  });

  it("returns_error_for_txt_file_wrong_mime", () => {
    const error = validateFile(makeTxtFile());
    expect(error).toMatch(/format/i);
  });

  it("returns_error_for_pdf_mime_with_wrong_extension", () => {
    // MIME pdf mais extension .xyz — doit être rejeté sur l'extension
    const file = new File([new Uint8Array(100)], "cv.xyz", {
      type: "application/pdf",
    });
    const error = validateFile(file);
    expect(error).toMatch(/extension/i);
  });
});

// ---------------------------------------------------------------------------
// DropZone — rendu initial (état idle)
// ---------------------------------------------------------------------------

describe("DropZone — idle state", () => {
  it("renders_drop_instruction_text", () => {
    render(<DropZone {...defaultProps()} />);
    expect(
      screen.getByText(/glisse ton CV ici/i)
    ).toBeInTheDocument();
  });

  it("renders_select_file_button", () => {
    render(<DropZone {...defaultProps()} />);
    expect(
      screen.getByRole("button", { name: /sélectionner un fichier/i })
    ).toBeInTheDocument();
  });

  it("renders_hidden_file_input", () => {
    render(<DropZone {...defaultProps()} />);
    const input = document.getElementById("cv-file-input") as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.type).toBe("file");
    expect(input.accept).toBe(".pdf,.docx");
  });

  it("does_not_render_error_message_in_idle_state", () => {
    render(<DropZone {...defaultProps()} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// DropZone — interaction clic
// ---------------------------------------------------------------------------

describe("DropZone — click behavior", () => {
  it("clicking_the_zone_triggers_input_click", async () => {
    render(<DropZone {...defaultProps()} />);

    const input = document.getElementById("cv-file-input") as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");

    const zone = screen.getByRole("button", {
      name: /zone de dépôt/i,
    });
    await userEvent.click(zone);

    // jsdom peut déclencher click une ou plusieurs fois selon l'event bubbling
    // (div zone + bouton enfant peuvent tous deux appeler input.click).
    // On vérifie qu'au moins un click a été déclenché, pas le nombre exact.
    expect(clickSpy).toHaveBeenCalled();
  });

  it("clicking_select_button_triggers_input_click", async () => {
    render(<DropZone {...defaultProps()} />);

    const input = document.getElementById("cv-file-input") as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");

    const button = screen.getByRole("button", {
      name: /sélectionner un fichier/i,
    });
    await userEvent.click(button);

    // Vérifie qu'au moins un click a été déclenché — le comportement exact
    // dépend de l'environnement jsdom vs navigateur réel.
    expect(clickSpy).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// DropZone — sélection via input
// ---------------------------------------------------------------------------

describe("DropZone — file input selection", () => {
  it("calls_onFile_with_valid_pdf_when_selected_via_input", () => {
    const onFile = vi.fn();
    render(<DropZone {...defaultProps()} onFile={onFile} />);

    const input = document.getElementById("cv-file-input") as HTMLInputElement;
    const file = makePdfFile();

    Object.defineProperty(input, "files", {
      value: [file],
      configurable: true,
    });

    fireEvent.change(input);

    expect(onFile).toHaveBeenCalledOnce();
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it("does_not_call_onFile_for_file_over_5mb_and_shows_error", () => {
    const onFile = vi.fn();
    render(<DropZone {...defaultProps()} onFile={onFile} />);

    const input = document.getElementById("cv-file-input") as HTMLInputElement;
    const oversizedFile = makeOversizedFile();

    Object.defineProperty(input, "files", {
      value: [oversizedFile],
      configurable: true,
    });

    fireEvent.change(input);

    expect(onFile).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/5 MB/i);
  });

  it("does_not_call_onFile_for_txt_file_and_shows_error", () => {
    const onFile = vi.fn();
    render(<DropZone {...defaultProps()} onFile={onFile} />);

    const input = document.getElementById("cv-file-input") as HTMLInputElement;
    const txtFile = makeTxtFile();

    Object.defineProperty(input, "files", {
      value: [txtFile],
      configurable: true,
    });

    fireEvent.change(input);

    expect(onFile).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("does_not_call_onFile_for_invalid_mime_file", () => {
    const onFile = vi.fn();
    render(<DropZone {...defaultProps()} onFile={onFile} />);

    const input = document.getElementById("cv-file-input") as HTMLInputElement;
    const invalidFile = new File([new Uint8Array(100)], "cv.pdf", {
      type: "image/png", // MIME invalide malgré extension .pdf
    });

    Object.defineProperty(input, "files", {
      value: [invalidFile],
      configurable: true,
    });

    fireEvent.change(input);

    expect(onFile).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// DropZone — drag and drop
// ---------------------------------------------------------------------------

describe("DropZone — drag and drop", () => {
  it("calls_onFile_when_valid_pdf_is_dropped", () => {
    const onFile = vi.fn();
    render(<DropZone {...defaultProps()} onFile={onFile} />);

    const zone = screen.getByRole("button", { name: /zone de dépôt/i });
    const file = makePdfFile();

    fireEvent.drop(zone, {
      dataTransfer: { files: [file] },
    });

    expect(onFile).toHaveBeenCalledOnce();
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it("does_not_call_onFile_when_oversized_file_is_dropped", () => {
    const onFile = vi.fn();
    render(<DropZone {...defaultProps()} onFile={onFile} />);

    const zone = screen.getByRole("button", { name: /zone de dépôt/i });

    fireEvent.drop(zone, {
      dataTransfer: { files: [makeOversizedFile()] },
    });

    expect(onFile).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/5 MB/i);
  });

  it("does_not_call_onFile_when_invalid_extension_is_dropped", () => {
    const onFile = vi.fn();
    render(<DropZone {...defaultProps()} onFile={onFile} />);

    const zone = screen.getByRole("button", { name: /zone de dépôt/i });

    fireEvent.drop(zone, {
      dataTransfer: { files: [makeTxtFile()] },
    });

    expect(onFile).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// DropZone — état uploading
// ---------------------------------------------------------------------------

describe("DropZone — uploading state", () => {
  it("renders_progress_bar_when_uploading", () => {
    render(
      <DropZone
        {...defaultProps()}
        state="uploading"
        uploadProgress={42}
        fileName="mon-cv.pdf"
      />
    );

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute("aria-valuenow", "42");
  });

  it("displays_filename_when_uploading", () => {
    render(
      <DropZone
        {...defaultProps()}
        state="uploading"
        fileName="mon-cv.pdf"
        uploadProgress={60}
      />
    );

    expect(screen.getByText("mon-cv.pdf")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// DropZone — état error (prop errorMessage depuis parent)
// ---------------------------------------------------------------------------

describe("DropZone — error state", () => {
  it("renders_error_message_from_parent", () => {
    render(
      <DropZone
        {...defaultProps()}
        state="error"
        errorMessage="Erreur serveur inattendue."
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Erreur serveur inattendue."
    );
  });

  it("renders_retry_button_in_error_state", () => {
    render(
      <DropZone
        {...defaultProps()}
        state="error"
        errorMessage="Erreur."
      />
    );

    expect(
      screen.getByRole("button", { name: /réessayer/i })
    ).toBeInTheDocument();
  });

  it("calls_onRetry_when_retry_button_clicked", async () => {
    const onRetry = vi.fn();
    render(
      <DropZone
        {...defaultProps()}
        state="error"
        errorMessage="Erreur."
        onRetry={onRetry}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /réessayer/i }));

    expect(onRetry).toHaveBeenCalledOnce();
  });
});
