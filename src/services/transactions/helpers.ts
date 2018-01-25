import { chunkArray, processAsyncItemsByChunks } from '../../helpers/helpers';

/**
 *
 */
export interface TransactionsGroupedByStatuses {
  success?: string[];
  failure?: string[];
}

/**
 *
 * @param transactionIds
 * @param chunkSize
 */
export async function getTransactionGroupedStatuses(transactionIds: string[], chunkSize: number): Promise<TransactionsGroupedByStatuses> {
  const result = await processAsyncItemsByChunks<string, any>(transactionIds, chunkSize, txId => this.getTxReceipt(txId));

  const data = result.filter(t => t).map(t => ({
    status: t.status,
    txId: t.transactionHash
  }));

  return {
    success: data.filter(t => t.status === '0x1').map(t => t.txId),
    failure: data.filter(t => t.status !== '0x1').map(t => t.txId)
  };
}
