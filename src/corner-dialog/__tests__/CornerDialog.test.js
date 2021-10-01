import React from 'react'
import { render, screen } from '@testing-library/react'
import { CornerDialog } from '..'
import { defaultTheme } from '../../themes'

const makeCornerDialogFixture = (props = {}) => {
  const { containerProps, ...remainingProps } = props
  return (
    <CornerDialog
      isShown
      title="Welcome to Segment!"
      {...remainingProps}
      containerProps={{ ...containerProps, 'data-testid': 'corner-dialog' }}
    >
      <p>Test</p>
    </CornerDialog>
  )
}

describe('CornerDialog', () => {
  it('renders without crashing', () => {
    expect(() => render(makeCornerDialogFixture())).not.toThrow()
  })

  it('Default values', () => {
    const { getByTestId, getByText } = render(makeCornerDialogFixture())
    const container = getByTestId('corner-dialog')
    expect(container).toBeInTheDocument()
    expect(getByText('Welcome to Segment!')).toBeInTheDocument()
    expect(getByText('Test')).toBeInTheDocument()

    const buttons = container.getElementsByTagName('button')
    expect(buttons).toHaveLength(3)
    expect(getByText('Learn More')).toBeInTheDocument()
    expect(getByText('Close')).toBeInTheDocument()
  })

  it('does not render if `isShown` is `false`', () => {
    const { getByTestId } = render(makeCornerDialogFixture({ isShown: false }))
    expect(() => getByTestId('corner-dialog')).toThrowErrorMatchingInlineSnapshot(`
      "Unable to find an element by: [data-testid=\\"corner-dialog\\"]

      [36m<body>[39m
        [36m<div[39m
          [33mevergreen-portal-container[39m=[32m\\"\\"[39m
        [36m/>[39m
        [36m<div />[39m
      [36m</body>[39m"
    `)
  })

  it('hides the footer if `hasFooter` is false', () => {
    render(makeCornerDialogFixture({ hasFooter: false }))

    expect(() => screen.getByText('Close')).toThrowError()
    expect(() => screen.getByText('Learn More')).toThrowError()
  })

  it('changes the confirm button intent when `intent` is passed in', () => {
    render(makeCornerDialogFixture({ intent: 'danger' }))
    expect(screen.getByText('Learn More')).toHaveStyle({ background: defaultTheme.colors.red500 })
  })

  it('changes the `confirmLabel` or `cancelLabel` when passed in', () => {
    render(makeCornerDialogFixture({ confirmLabel: 'Confirm', cancelLabel: 'Close' }))
    expect(screen.getByText('Confirm')).toBeInTheDocument()
    expect(screen.getByText('Close')).toBeInTheDocument()
  })

  it('handles `onConfirm` and `onCancel` props that are passed in', () => {})
  it('hides the cancel button when `hasCancel` is `false', () => {})
})
