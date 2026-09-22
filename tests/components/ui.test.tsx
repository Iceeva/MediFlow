// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { DataTable } from "@/components/ui/data-table";

afterEach(cleanup);

describe("StatusBadge", () => {
  it("renders a readable label", () => {
    render(<StatusBadge status="PARTIALLY_PAID" />);
    expect(screen.getByText("partially paid")).toBeTruthy();
  });
});

describe("Button", () => {
  it("is disabled and busy while loading", () => {
    render(<Button loading>Save</Button>);
    const b = screen.getByRole("button") as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    expect(b.getAttribute("aria-busy")).toBe("true");
  });
});

describe("Field", () => {
  it("links the label and announces errors", () => {
    render(<Field label="Email" error="Enter a valid email">{(p) => <Input {...p} />}</Field>);
    const input = screen.getByLabelText("Email");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("Enter a valid email");
  });
});

describe("DataTable states", () => {
  type Row = { id: string; name: string };
  const columns = [{ key: "n", header: "Name", cell: (r: Row) => r.name }];

  it("shows rows", () => {
    render(<DataTable<Row> columns={columns} rows={[{ id: "1", name: "Ada" }]} />);
    expect(screen.getByText("Ada")).toBeTruthy();
  });

  it("shows an empty state", () => {
    render(<DataTable<Row> columns={columns} rows={[]} empty={{ title: "No patients yet" }} />);
    expect(screen.getByText("No patients yet")).toBeTruthy();
  });

  it("shows an error state with retry", () => {
    const retry = vi.fn();
    render(<DataTable<Row> columns={columns} error={new Error("boom")} onRetry={retry} />);
    expect(screen.getByRole("alert").textContent).toContain("boom");
    fireEvent.click(screen.getByText("Try again"));
    expect(retry).toHaveBeenCalled();
  });

  it("paginates", () => {
    const onPage = vi.fn();
    render(<DataTable<Row> columns={columns} rows={[{ id: "1", name: "Ada" }]} meta={{ page: 1, pageSize: 1, total: 3, totalPages: 3 }} onPage={onPage} />);
    fireEvent.click(screen.getByText("Next"));
    expect(onPage).toHaveBeenCalledWith(2);
    expect((screen.getByText("Previous").closest("button") as HTMLButtonElement).disabled).toBe(true);
  });
});
