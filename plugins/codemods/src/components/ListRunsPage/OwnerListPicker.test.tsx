import React from 'react';
import { renderInTestApp } from '@backstage/test-utils';
import { fireEvent } from '@testing-library/react';
import { OwnerListPicker } from './OwnerListPicker';

describe('<OwnerListPicker />', () => {
  it('should render the tasks owner filter', async () => {
    const props = {
      filter: 'owned',
      onSelectOwner: jest.fn(),
    };

    const { getByText } = await renderInTestApp(<OwnerListPicker {...props} />);

    expect(getByText('Owned')).toBeDefined();
    expect(getByText('All')).toBeDefined();
  });

  it('should call the function on select other item', async () => {
    const props = {
      filter: 'owned',
      onSelectOwner: jest.fn(),
    };

    const { getByText } = await renderInTestApp(<OwnerListPicker {...props} />);

    fireEvent.click(getByText('All'));
    expect(props.onSelectOwner).toHaveBeenCalledWith('all');
  });
});
