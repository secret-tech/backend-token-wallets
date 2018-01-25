const restore = require('mongodb-restore');
import { container } from '../src/ioc.container';
import config from '../src/config';

beforeEach(function (done) {
  restore({
    uri: config.typeOrm.url,
    root: __dirname + '/dbfixtures/test',
    parser: 'json',
    drop: true,
    callback: function () {
      done();
    }
  });
});
