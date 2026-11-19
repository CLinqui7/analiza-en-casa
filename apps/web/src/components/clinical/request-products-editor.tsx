'use client';

import { useMemo } from 'react';
import { Button } from '@analiza/ui';
import { SearchableSelect } from '@/components/common/searchable-select';
import {
  feeServices,
  requestCategoryLabels,
  supplyRequestProduct,
  type RequestProduct,
  type SupplyRequestCatalogItem,
} from '@/lib/supply-requests';
import { quoteMedicalFeeOptions } from '@/lib/quote-medical-fees';
import styles from './request-products-editor.module.css';

type Category = keyof typeof requestCategoryLabels | 'PHYSICAL';
export type RequestProductDraft = {
  key: string;
  category: Category;
  item: string;
  quantity: string;
  fee: string;
};
export const blankRequestProduct = (): RequestProductDraft => ({
  key: crypto.randomUUID(),
  category: 'PHYSICAL',
  item: '',
  quantity: '1',
  fee: '',
});
export function readProductRows(rows: RequestProductDraft[]): RequestProduct[] {
  return rows.map((row) =>
    supplyRequestProduct.parse(
      row.category === 'FEES'
        ? {
            feeService: row.item,
            feeAmount: row.fee === '' ? null : Number(row.fee),
            quantity: Number(row.quantity),
          }
        : { catalogItemId: row.item, quantity: Number(row.quantity) },
    ),
  );
}

export function RequestProductsEditor({
  rows,
  onChange,
  catalog,
  busy = false,
  minimum = 0,
  maximum = 50,
}: {
  rows: RequestProductDraft[];
  onChange: (rows: RequestProductDraft[]) => void;
  catalog: readonly SupplyRequestCatalogItem[];
  busy?: boolean;
  minimum?: number;
  maximum?: number;
}) {
  const byCategory = useMemo(() => {
    const options: Record<string, { value: string; label: string }[]> = { PHYSICAL: [] };
    for (const item of catalog) {
      const entry = {
        value: item.id,
        label: `${requestCategoryLabels[item.category]} · ${item.sku} · ${item.name}`,
      };
      (options[item.category] ??= []).push(entry);
      if (['MEDICATIONS', 'SUPPLIES', 'EQUIPMENT'].includes(item.category))
        options.PHYSICAL.push(entry);
    }
    return options;
  }, [catalog]);
  function patch(key: string, update: Partial<RequestProductDraft>) {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...update } : row)));
  }
  return (
    <div className={styles.editor}>
      {rows.map((row, index) => (
        <fieldset key={row.key} className={styles.line} disabled={busy}>
          <legend>Concepto {index + 1}</legend>
          <label>
            Categoría
            <select
              value={row.category}
              onChange={(event) =>
                patch(row.key, { category: event.target.value as Category, item: '', fee: '' })
              }
            >
              <option value="PHYSICAL">Medicamentos, insumos y equipos</option>
              {Object.entries(requestCategoryLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {row.category === 'FEES' ? 'Servicio médico' : 'Concepto de catálogo'}
            {row.category === 'FEES' ? (
              <select
                value={row.item}
                onChange={(event) => patch(row.key, { item: event.target.value })}
                required
              >
                <option value="">Seleccione un servicio</option>
                {feeServices.map((service) => (
                  <option key={service}>{service}</option>
                ))}
              </select>
            ) : (
              <SearchableSelect
                ariaLabel={
                  row.category === 'PHYSICAL'
                    ? 'Buscar medicamento, insumo o equipo'
                    : 'Buscar concepto de catálogo'
                }
                value={row.item}
                onChange={(item) => patch(row.key, { item })}
                options={byCategory[row.category] ?? []}
                placeholder="Buscar código o nombre"
                disabled={busy}
              />
            )}
          </label>
          {row.category === 'FEES' && (
            <label>
              Honorario médico
              <select
                value={row.fee}
                onChange={(event) => patch(row.key, { fee: event.target.value })}
                required
              >
                <option value="">Seleccione un importe</option>
                {quoteMedicalFeeOptions.map((fee) => (
                  <option key={fee} value={fee}>
                    USD {fee.toFixed(2)}
                  </option>
                ))}
              </select>
              <span className="field-help">Se vincula al médico tratante de la cotización.</span>
            </label>
          )}
          <label>
            Cantidad
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="100000"
              step="1"
              required
              value={row.quantity}
              onChange={(event) => patch(row.key, { quantity: event.target.value })}
            />
          </label>
          {rows.length > minimum && (
            <Button
              type="button"
              className="button-secondary"
              aria-label={`Quitar concepto ${index + 1}`}
              onClick={() => onChange(rows.filter((line) => line.key !== row.key))}
            >
              Quitar
            </Button>
          )}
        </fieldset>
      ))}
      {rows.length < maximum && (
        <Button
          type="button"
          className="button-secondary"
          disabled={busy}
          onClick={() => onChange([...rows, blankRequestProduct()])}
        >
          {rows.length ? 'Agregar otro concepto' : 'Agregar concepto'}
        </Button>
      )}
    </div>
  );
}
