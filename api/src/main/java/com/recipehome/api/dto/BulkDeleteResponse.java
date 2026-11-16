package com.recipehome.api.dto;

import java.util.List;

/**
 * Response of POST /api/recipes/bulk-delete: the ids that were deleted by this request,
 * in request order. Ids that were unknown or already deleted are not included.
 */
public record BulkDeleteResponse(List<Long> deletedIds) {
}
