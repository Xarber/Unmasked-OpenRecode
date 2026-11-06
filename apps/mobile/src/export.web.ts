// SPDX-License-Identifier: AGPL-3.0-only
export async function exportText(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: name.endsWith('.json') ? 'application/json' : 'text/markdown' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
