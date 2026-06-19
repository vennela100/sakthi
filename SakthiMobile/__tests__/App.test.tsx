/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.useFakeTimers();

test('renders correctly', async () => {
  let tree;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
    jest.runOnlyPendingTimers();
  });

  ReactTestRenderer.act(() => {
    tree?.unmount();
  });
});
