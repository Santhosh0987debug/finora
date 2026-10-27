import type { Category, CategoryType } from "../types/api";
import { apiRequest } from "./client";
import {
  arrayField,
  asRecord,
  oneOf,
  stringField,
} from "./validation";

const CATEGORY_TYPES: readonly CategoryType[] = ["INCOME", "EXPENSE"];

function parseCategory(value: unknown): Category {
  const category = asRecord(value, "category");
  return {
    id: stringField(category, "id", "category id"),
    name: stringField(category, "name", "category name"),
    type: oneOf(category.type, CATEGORY_TYPES, "category type"),
  };
}

export async function fetchCategories(
  token: string,
  signal?: AbortSignal,
): Promise<Category[]> {
  const payload = await apiRequest<unknown>("/api/categories", {
    token,
    signal,
  });
  const response = asRecord(payload, "categories response");
  return arrayField(response, "categories", "categories").map(parseCategory);
}
