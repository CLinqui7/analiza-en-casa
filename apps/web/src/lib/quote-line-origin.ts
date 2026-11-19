/** Clinical additions keep the request's line ID across all versions, including older quotes. */
export function quoteLineOrigin(id: string) {
  return id.startsWith('supply-request-') ? 'Adicional' : 'Original';
}
