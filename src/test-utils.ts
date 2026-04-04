import { mock } from 'bun:test'
import type { TablesDB } from 'appwrite'

export function createStrictMockDb(): TablesDB {
  return {
    listRows: mock(() => {
      throw new Error('FORGOT TO MOCK: listRows()')
    }),
    getRow: mock(() => {
      throw new Error('FORGOT TO MOCK: getRow()')
    }),
    createRow: mock(() => {
      throw new Error('FORGOT TO MOCK: createRow()')
    }),
    updateRow: mock(() => {
      throw new Error('FORGOT TO MOCK: updateRow()')
    }),
    deleteRow: mock(() => {
      throw new Error('FORGOT TO MOCK: deleteRow()')
    }),
  } as TablesDB
}
