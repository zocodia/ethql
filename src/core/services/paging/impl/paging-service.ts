import * as _ from 'lodash';
import { PagingService } from '..';
import { PageInfo, PageInfoBackward, PageInfoForward } from '../../../model';

export enum PageDirection {
  FORWARD = 'forward',
  BACKWARD = 'backward',
}

export class PagingServiceImpl implements PagingService {
  public createPageObject(before: number, after: number, resultSet: any[], hasMore: () => boolean): PageInfo {
    const direction: PageDirection = before ? PageDirection.BACKWARD : PageDirection.FORWARD;
    const blockNumbers: number[] = _.map(resultSet, it => it.number);
    const [first, last]: number[] = [_.min(blockNumbers), _.max(blockNumbers)];

    return direction === PageDirection.BACKWARD
      ? new PageInfoBackward(
          `${this.serializeCursor(resultSet, first.toString())}`,
          `${this.serializeCursor(resultSet, last.toString())}`,
          true,
        )
      : new PageInfoForward(
          `${this.serializeCursor(resultSet, first.toString())}`,
          `${this.serializeCursor(resultSet, (last + 1).toString())}`,
          hasMore(),
        );
  }

  public serializeCursor(resultSet: any[], cursorRef: string) {
    const resultType: string = resultSet[0].constructor.name;
    return new Buffer(`${resultType}/${cursorRef}`).toString('base64');
  }

  public deserializeCursor(cursor: string): string[] {
    const decodeCursor = new Buffer(cursor, 'base64');
    return decodeCursor.toString('ascii').split('/');
  }
}
