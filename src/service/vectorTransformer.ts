// Copyright (c) 2025-2026 Raj
// See LICENSE for details.

import { pipeline } from "@xenova/transformers";

async function getVectorEmbedding(text: string) {
  // Load once, reuse later
  const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");

  // Pooling = "mean" → average across tokens
  // Normalize = true → unit vector (better for cosine similarity)
  const output = await extractor(text, {
    pooling: "mean",
    normalize: true,
  });

  // Convert Tensor to flat JS array
  const vector = Array.from(output.data);
  return vector;
}

export default getVectorEmbedding;
