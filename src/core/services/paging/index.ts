import { PageInfo } from '../../model/index';

declare module '../../../services' {
  interface EthqlServices {
    pagingService: PagingService;
  }

  interface EthqlServiceDefinitions {
    pagingService: EthqlServiceDefinition<{}, PagingService>;
  }
}

export interface PagingService {
  createPageObject(after: number, before: number, cursor: any, hasMore: () => boolean): PageInfo;
  deserializeCursor(cursorRef: string): any[];
  serializeCursor(resultSet: any, cursorRef: string);
}
