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

    return direction === PageDirection.BACKWARD
      ? new PageInfoBackward(`${this.serializeCursor(resultSet, _.min(blockNumbers).toString())}`, true)
      : new PageInfoForward(`${this.serializeCursor(resultSet, (_.max(blockNumbers) + 1).toString())}`, hasMore());
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
