'use strict';

function parsePagination(rawPage, rawLimit, defaults = {}) {
  const pageDefault = defaults.page || 1;
  const limitDefault = defaults.limit || 50;
  const limitMax = defaults.maxLimit || 200;

  const pageParsed = Number.parseInt(rawPage, 10);
  const limitParsed = Number.parseInt(rawLimit, 10);

  const page =
    Number.isFinite(pageParsed) && pageParsed > 0 ? pageParsed : pageDefault;
  const limitCandidate =
    Number.isFinite(limitParsed) && limitParsed > 0
      ? limitParsed
      : limitDefault;
  const limit = Math.min(limitCandidate, limitMax);

  return { page, limit };
}

function paginateItems(items, page, limit) {
  const totalCount = items.length;
  const offset = (page - 1) * limit;
  return {
    page,
    limit,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / limit)),
    items: items.slice(offset, offset + limit),
  };
}

module.exports = {
  paginateItems,
  parsePagination,
};
