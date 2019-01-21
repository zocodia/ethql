import { ArgumentNode, FieldNode, GraphQLResolveInfo, ListValueNode, ObjectFieldNode, ObjectValueNode } from 'graphql';
import * as _ from 'lodash';
import { EthqlAccount, EthqlBlock, EthqlLog, EthqlTransaction, TransactionStatus } from '../../model';

declare module '../../../services' {
  interface EthqlServices {
    ethService: EthService;
  }

  interface EthqlServiceDefinitions {
    ethService: EthqlServiceDefinition<{}, EthService>;
  }
}

const TX_REQUIRING_FIELDS = ['transactions', 'transactionsInvolving', 'transactionsRoles'];

export type FetchHints = { transactions?: boolean; logs?: boolean; logFilters?: string[] };

export interface EthService {
  fetchBlock(id: number | string, infoOrHints: GraphQLResolveInfo | FetchHints): Promise<EthqlBlock>;
  fetchTxFromBlock(blockHash: string, txIndex: number): Promise<EthqlTransaction>;
  fetchStandaloneTx(txHash: string): Promise<EthqlTransaction>;
  fetchBalance(account: EthqlAccount): Promise<number>;
  fetchCode(account: EthqlAccount): Promise<string | undefined>;
  fetchStorage(account: EthqlAccount, position: number): Promise<string>;
  fetchTransactionCount(account: EthqlAccount): Promise<number>;
  fetchTransactionLogs(tx: EthqlTransaction, filter: any): Promise<EthqlLog[]>;
  fetchCreatedContract(tx: EthqlTransaction): Promise<EthqlAccount>;
  fetchTransactionStatus(tx: EthqlTransaction): Promise<TransactionStatus>;
}

/**
 * Returns an object with the fetch hints for this block.
 *
 * @param info The GraphQL resolution info.
 */
export function fetchHints(info: GraphQLResolveInfo): FetchHints {
  const txFields = info.fieldNodes[0].selectionSet.selections.filter(
    s => s.kind === 'Field' && TX_REQUIRING_FIELDS.indexOf(s.name.value) >= 0,
  );

  const logsFields = _.flatMap(txFields, f =>
    (f as FieldNode).selectionSet.selections.filter(f => f.kind === 'Field' && f.name.value === 'logs'),
  );

  // Extract log filters out of the GraphQLResolveInfo
  // Since logs are resolved with blocks when they are nested in the query, we must pull out
  // the filter arguments here so that we can use them in the blocks resolution
  // There has to be a better way to do this...
  const logFilters = _.chain(logsFields)
    .flatMap(f => (f as FieldNode).arguments as ArgumentNode[]) //
    .filter(a => a.name.value === 'filter')
    .flatMap(a => (a.value as ObjectValueNode).fields)
    .map(f => {
      let values = ((f as ObjectFieldNode).value as ListValueNode).values;
      // Assume Bytes32 or null fields only here.
      return _.map(values, v => (v.kind === 'StringValue' ? v.value : null));
    })
    .value();

  const filters = _.flatMap(txFields, f => (f as FieldNode).arguments as ArgumentNode[]) //
    .filter(a => a.name.value === 'filter');

  const withLogFilters = _.flatMap(filters, a => (a.value as ObjectValueNode).fields as ObjectFieldNode[]) //
    .filter(af => (af as ObjectFieldNode).name.value === 'withLogs');

  return {
    transactions: !!txFields.length,
    logs: !!logsFields.length || !!withLogFilters.length,
    logFilters: logFilters[0],
  };
}
