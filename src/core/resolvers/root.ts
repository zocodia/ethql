import { GraphQLResolveInfo } from 'graphql';
import * as _ from 'lodash';
import { stringify } from 'querystring';
import { EthqlContext } from '../../context';
import { EthqlAccount, EthqlBlock, EthqlTransaction, PagedEthqlBlock } from '../model';

// Select a single block.
type BlockArgs = { number?: number; hash?: string; tag?: string };

// Select a single block with an offset.
type BlockOffsetArgs = BlockArgs & { offset?: number };

// Select multiple blocks.
type BlocksArgs = { numbers?: number[]; hashes?: string[] };

// Select multiple blocks.
type BlocksRangeArgs = { numberRange?: [number, number]; hashRange?: [string, string] };

type PagedBlockArgs = BlockArgs & { cursor?: string; after?: number; before?: number };

async function block(obj, args: BlockArgs, { services }: EthqlContext, info: GraphQLResolveInfo): Promise<EthqlBlock> {
  let { number: blockNumber, hash, tag } = args;
  hash = hash ? hash.trim() : hash;
  tag = tag ? tag.trim().toLowerCase() : tag;

  const params = _.reject([blockNumber, hash, tag], _.isNil);

  if (!params.length) {
    throw new Error('Expected either number, hash or tag argument.');
  }
  if (params.length > 1) {
    throw new Error('Only one of number, hash or tag argument should be provided.');
  }

  return services.ethService.fetchBlock(params[0], info);
}

async function blockOffset(
  obj: never,
  args: BlockOffsetArgs,
  { services }: EthqlContext,
  info: GraphQLResolveInfo,
): Promise<EthqlBlock> {
  const { number, hash, tag, offset } = args;
  const params = _.reject([number, hash, tag], _.isNil);

  // Offset 0 is allowed.
  if (offset === undefined || params.length === 0) {
    throw new Error('Expected either number, tag or hash argument and offset argument.');
  }

  if (params.length > 1) {
    throw new Error('Only one of number, hash or tag argument should be provided.');
  }

  const blockNumber = number || (await services.ethService.fetchBlock(hash || tag.toLowerCase(), {})).number;
  return services.ethService.fetchBlock(blockNumber + offset, info);
}

async function blocks(
  obj: never,
  { numbers, hashes }: BlocksArgs,
  { services, config }: EthqlContext,
  info: GraphQLResolveInfo,
): Promise<EthqlBlock[]> {
  const { queryMaxSize } = config;

  if (numbers && hashes) {
    throw new Error('Only one of numbers or hashes should be provided.');
  }

  if (!(numbers || hashes)) {
    throw new Error('At least one of numbers or hashes must be provided.');
  }

  if ((numbers && numbers.length > queryMaxSize) || (hashes && hashes.length > queryMaxSize)) {
    throw new Error(`Too large a multiple selection. Maximum length allowed: ${queryMaxSize}.`);
  }

  let input = numbers
    ? numbers.map(n => services.ethService.fetchBlock(n, info))
    : hashes.map(h => services.ethService.fetchBlock(h, info));

  return Promise.all(input);
}

async function blocksRange(
  obj: never,
  { numberRange, hashRange }: BlocksRangeArgs,
  { services, config }: EthqlContext,
  info: GraphQLResolveInfo,
): Promise<EthqlBlock[]> {
  if (numberRange && hashRange) {
    throw new Error('Only one of blocks or hashes should be provided.');
  }

  if (!(numberRange || hashRange)) {
    throw new Error('Expected either a number range or a hash range.');
  }

  let start: number;
  let end: number;

  if (numberRange && numberRange.length === 2) {
    // We've received start and end block numbers.
    [start, end] = numberRange;
    if (start < 0 || end < 0) {
      throw new Error('Invalid block number provided.');
    }
  } else if (hashRange && hashRange.length === 2) {
    // We've received start and end hashes, so we need to resolve them to block numbers first to delimit the range.
    const blocks = await Promise.all(hashRange.map(b => services.ethService.fetchBlock(b as any, {})));
    if (blocks.indexOf(null) >= 0) {
      throw new Error('Could not resolve the block associated with one or all hashes.');
    }
    [start, end] = blocks.map(b => b.number);
  } else {
    throw new Error('Exactly two elements were expected: the start and end blocks.');
  }

  if (start > end) {
    throw new Error('Start block in the range must be prior to the end block.');
  }

  if (end - start + 1 > config.queryMaxSize) {
    throw new Error(`Too large a multiple selection. Maximum length allowed: ${config.queryMaxSize}.`);
  }

  const blocksRange = Array.from({ length: end - start + 1 }, (_, k) => k + start);
  return Promise.all(blocksRange.map(blockNumber => services.ethService.fetchBlock(blockNumber, info)));
}

async function pageBlocks(
  obj: never,
  args: PagedBlockArgs,
  { services, config }: EthqlContext,
  info: GraphQLResolveInfo,
): Promise<PagedEthqlBlock> {
  console.log(args);
  let { number, hash, tag, cursor, before, after } = args;
  const params = _.reject([cursor, number, hash, tag ? tag.toLowerCase() : null], _.isNil);
  tag = tag ? tag.toLowerCase() : null;

  if (!params.length) {
    throw new Error('Expected either cursor, number, hash or tag argument.');
  }

  if (params.length > 1) {
    throw new Error('Only one of cursor, number, hash or tag argument should be provided.');
  }

  if (before && after) {
    throw new Error(`You cannot specify paging in 2 directions: specify either before or after`);
  }

  if (!(before || after)) {
    throw new Error(`You must specify before or after in a paged query`);
  }

  if (cursor) {
    const [resultType, blockNum] = services.pagingService.deserializeCursor(cursor);
    console.log(resultType, blockNum);
    params[0] = blockNum;
  }

  // Fetch the upper bound
  const boundary: number = await services.ethService.fetchBlockNumber();
  console.log(boundary);

  // Get the first block in the series
  // In case we get a tag or a hash, we need to fetch the block to get the block number
  let firstBlock: EthqlBlock = await services.ethService.fetchBlock(params[0], info);
  const startingBlock = firstBlock.number;

  // Get a page of blocknumbers
  let [start, end] = before ? [startingBlock - before, startingBlock] : [startingBlock, startingBlock + after];
  let page: number[] = _.range(start, end);

  // Query for all of the blocks and calculate the paging object
  return Promise.all(_.map(page, blkNum => services.ethService.fetchBlock(blkNum, info)))
    .then((results: EthqlBlock[]) => {
      return _.reject(results, _.isNil);
    })
    .then(filteredResults => {
      return new PagedEthqlBlock(
        filteredResults,
        services.pagingService.createPageObject(
          before,
          after,
          filteredResults,
          () => firstBlock.number + after <= boundary,
        ),
      );
    });
}

function account(obj, { address }): EthqlAccount {
  return new EthqlAccount(address);
}

function transaction(obj, { hash }, { services }: EthqlContext): Promise<EthqlTransaction> {
  return services.ethService.fetchStandaloneTx(hash);
}

export default {
  Query: {
    block,
    blocks,
    blockOffset,
    blocksRange,
    account,
    transaction,
    pageBlocks,
  },
};
