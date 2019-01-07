import { PageInfo, PageInfoBackward, PageInfoForward } from '../../core/model';
import { PagingServiceImpl } from '../../core/services/paging/impl/paging-service';
import { PagingService } from '../../core/services/paging/index';

const pagingService: PagingService = new PagingServiceImpl();

test('paging cursor encoding', () => {
  let resultSet: string[] = ['test'];
  let blockNumber: number = 1234567890;
  let expectedResult: Buffer = new Buffer(`${resultSet[0].constructor.name}/${blockNumber}`);

  expect(pagingService.serializeCursor(resultSet, blockNumber.toString())).toBe(expectedResult.toString('base64'));
});

test('paging cursor decoding', () => {
  let encodedCursor = new Buffer('string/1234567890').toString('base64');
  let result = pagingService.deserializeCursor(encodedCursor);

  expect(Array.isArray(result)).toBe(true);
  expect(result[0]).toBe('string');
  expect(result[1]).toBe('1234567890');
});

test('paging backward', () => {
  let result: PageInfo = pagingService.createPageObject(10, undefined, [{ number: 10 }], undefined);

  expect(result).toHaveProperty('hasPreviousPage');
  expect(result).not.toHaveProperty('hasNextPage');
  expect((result as PageInfoBackward).hasPreviousPage).toBe(true);
  expect(result.cursor).toBeTruthy();
});

test('paging foward', () => {
  const mockHasMore = jest.fn(x => true);
  let result: PageInfo = pagingService.createPageObject(undefined, 10, [{ number: 10 }], mockHasMore);

  expect(mockHasMore).toBeCalledTimes(1);
  expect(result).toHaveProperty('hasNextPage');
  expect(result).not.toHaveProperty('hasPreviousPage');
  expect((result as PageInfoForward).hasNextPage).toBe(true);
  expect(result.cursor).toBeTruthy();
});
