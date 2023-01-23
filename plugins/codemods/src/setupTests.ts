import '@testing-library/jest-dom';
import 'cross-fetch/polyfill';

const { EventSourcePolyfill } = jest.requireMock('event-source-polyfill');
global.EventSource = EventSourcePolyfill;
