/** ERA 公共 Facade 的手工按钮测试。 */
import { Logger } from './utils';

const logger = new Logger('ApiTest');

const insertSuite = [
  { insert: { testData: { user: { name: 'Tester', level: 1 }, status: 'active' } } },
  { insert: { inventory: { gold: 100, slots: ['sword', 'shield'] } } },
];
const editSuite = [
  { edit: { testData: { user: { name: 'Advanced Tester', level: 5 }, status: 'idle' } } },
  { edit: { inventory: { gold: { $expr: 'inventory.gold + 50' } } } },
];
const deleteSuite = [{ delete: { inventory: {} } }, { delete: { testData: { status: {} } } }];

async function commit(operations: any[]) {
  await waitGlobalInitialized('ERA');
  const receipt = await ERA.commit(operations, { scope: 'always' });
  logger.log('commit', JSON.stringify(receipt));
}

$(() => {
  logger.log('init', 'ERA Facade 测试脚本已加载');
  eventOn(getButtonEvent('Run Insert Tests'), () => void commit(insertSuite));
  eventOn(getButtonEvent('Run Update Tests'), () => void commit(editSuite));
  eventOn(getButtonEvent('Run Delete Tests'), () => void commit(deleteSuite));
  eventOn(getButtonEvent('Get Current Vars'), () => {
    void waitGlobalInitialized('ERA').then(() => logger.log('state', JSON.stringify(ERA.get())));
  });
});
