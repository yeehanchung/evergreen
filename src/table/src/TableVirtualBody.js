import React, { memo, useState, useEffect, useRef, useMemo, useCallback } from 'react'
import debounce from 'lodash.debounce'
import PropTypes from 'prop-types'
import { VariableSizeList, areEqual } from 'react-window'
import { useLatest } from '../../hooks'
import { Pane } from '../../layers'

function getChildArray(children) {
  return Array.isArray(children) ? children : React.Children.toArray(children)
}

function getChildrenCount(children) {
  return React.Children.count(getChildArray(children))
}

/* eslint-disable react/prop-types */
const Row = memo(({ data, index, style }) => {
  const { allowAutoHeight, autoHeights, items, onVirtualHelperRef } = data
  const child = getChildArray(items)[index]
  const key = child.key || index
  const props = {
    key,
    style
  }

  // If some children are strings by accident, support this gracefully.
  if (!React.isValidElement(child)) {
    if (typeof child === 'string') {
      return <div {...props}>{child}</div>
    }

    return <div {...props}>&nbsp;</div>
  }

  // When allowing height="auto" for rows, and a auto height item is
  // rendered for the first time...
  if (
    allowAutoHeight &&
    React.isValidElement(child) &&
    child.props.height === 'auto' &&
    // ... and only when the height is not already been calculated.
    !autoHeights.current[index]
  ) {
    // ... render the item in a helper div, the ref is used to calculate
    // the height of its children.
    return (
      <div
        ref={ref => onVirtualHelperRef(index, ref)}
        data-virtual-index={index}
        {...props}
        style={{
          opacity: 0,
          ...props.style
        }}
      >
        {child}
      </div>
    )
  }

  // When allowAutoHeight is false, or when the height is known.
  // Simply render the item.
  return React.cloneElement(child, props)
}, areEqual)
/* eslint-enable react/prop-types */

const TableVirtualBody = memo(function TableVirtualBody(props) {
  const {
    allowAutoHeight = false,
    children,
    defaultHeight = 48,
    estimatedItemSize,
    height: paneHeight,
    onScroll,
    overscanCount = 5,
    scrollOffset,
    scrollToAlignment,
    scrollToIndex,
    useAverageAutoHeightEstimation = true,
    ...rest
  } = props

  const autoHeights = useRef([])
  const autoHeightRefs = useRef([])
  const [averageAutoHeight, setAverageAutoHeight] = useState(defaultHeight)

  const paneRef = useRef(null)
  const listRef = useRef(null)
  const rafRef = useRef()
  const [calculatedHeight, setCalculatedHeight] = useState(0)
  const isIntegerHeight = useMemo(() => Number.isInteger(paneHeight), [paneHeight])

  // Children always needs to be an array.
  const latestChildren = useLatest(children)

  // When the scrollToIndex (or alignment) changes
  // Try to programmatically scroll to the new position
  useEffect(() => {
    if (listRef.current && typeof scrollToIndex === 'number') {
      listRef.current.scrollToItem(scrollToIndex, scrollToAlignment)
    }
  }, [scrollToIndex, scrollToAlignment])

  // When the scrollOffset changes
  // Try to programmatically scroll to the new position
  useEffect(() => {
    if (listRef.current && typeof scrollOffset === 'number') {
      listRef.current.scrollTo(scrollOffset)
    }
  }, [scrollOffset])

  // Cleanup any outstanding animation frame requests
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const updateOnResize = useCallback(() => {
    const updater = () => {
      autoHeights.current = []
      autoHeightRefs.current = []
      setAverageAutoHeight(defaultHeight)

      // Simply return when we now the height of the pane is fixed.
      if (isIntegerHeight) return

      // Return if we are in a weird edge case in which the ref is no longer valid.
      if (paneRef.current instanceof Node) {
        const tempCalculatedHeight = paneRef.current.offsetHeight

        if (tempCalculatedHeight > 0) {
          // Save the calculated height which is needed for the VirtualList.
          setCalculatedHeight(tempCalculatedHeight)

          // Prevent updateOnResize being called recursively when there is a valid height.
          return
        }
      }

      // When height is still 0 (or paneRef is not valid) try recursively until success.
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        updater()
      })
    }

    updater()
  }, [defaultHeight, isIntegerHeight])

  const onResize = useMemo(() => debounce(updateOnResize, 200), [updateOnResize])

  // Mirrors functionality of componentDidMount and componentWillUnmount.
  // By passing an empty array, will only run on first render, the function returned
  // will be called on component unmount
  useEffect(() => {
    updateOnResize()
    window.addEventListener('resize', onResize, false)

    return () => {
      window.removeEventListener('resize', onResize)
    }
  }, [updateOnResize, onResize])

  /**
   * This function will process all items that have height="auto" set.
   * It will loop through all refs and get calculate the height.
   */
  const processAutoHeights = useCallback(() => {
    let isUpdated = false

    // This will determine the averageAutoHeight.
    let total = 0
    let totalAmount = 0

    // Loop through all of the refs that have height="auto".
    autoHeightRefs.current.forEach((ref, index) => {
      // If the height is already calculated, skip it,
      // but calculate the height for the total.
      if (autoHeights.current[index]) {
        total += autoHeights.current[index]
        totalAmount += 1
        return
      }

      // Make sure the ref has a child
      if (ref && ref.childNodes && ref.childNodes[0] && Number.isInteger(ref.childNodes[0].offsetHeight)) {
        const height = ref.childNodes[0].offsetHeight

        // Add to the total to calculate the averageAutoHeight.
        total += height
        totalAmount += 1

        // Cache the height.
        autoHeights.current[index] = height

        // Set the update flag to true.
        isUpdated = true
      }
    })

    // Save the average height.
    setAverageAutoHeight(total / totalAmount)

    // There are some new heights detected that had previously not been calculated.
    // Call forceUpdate to make sure the virtual list renders again.
    if (isUpdated && listRef.current) {
      listRef.current.resetAfterIndex(0, true)
    }
  }, [])

  const onVirtualHelperRef = useCallback(
    (index, ref) => {
      autoHeightRefs.current[index] = ref

      requestAnimationFrame(() => {
        processAutoHeights()
      })
    },
    [processAutoHeights]
  )

  const itemSizeFn = useCallback(
    index => {
      const children = getChildArray(latestChildren.current)
      const item = children[index]
      if (!React.isValidElement(item)) return defaultHeight

      const { height } = item.props
      // When the height is number simply, simply return it.
      if (Number.isInteger(height)) {
        return height
      }

      // When allowAutoHeight is set and the height is set to "auto"...
      if (allowAutoHeight && height === 'auto') {
        // ... and the height is calculated, return the calculated height.
        if (autoHeights.current[index]) return autoHeights.current[index]

        // ... if the height is not yet calculated, return the averge
        if (useAverageAutoHeightEstimation) return averageAutoHeight
      }

      // If all else fails, return the default height.
      return defaultHeight
    },
    // latestChildren is a ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allowAutoHeight, useAverageAutoHeightEstimation, averageAutoHeight, defaultHeight]
  )

  const itemData = useMemo(
    () => ({
      items: children,
      autoHeights,
      allowAutoHeight,
      onVirtualHelperRef
    }),
    [children, allowAutoHeight, onVirtualHelperRef]
  )

  return (
    <Pane data-evergreen-table-body ref={paneRef} height={paneHeight} flex="1" overflow="hidden" {...rest}>
      <VariableSizeList
        ref={listRef}
        height={isIntegerHeight ? paneHeight : calculatedHeight}
        width="100%"
        estimatedItemSize={
          allowAutoHeight && useAverageAutoHeightEstimation ? averageAutoHeight : estimatedItemSize || null
        }
        itemSize={itemSizeFn}
        overscanCount={overscanCount}
        itemCount={getChildrenCount(children)}
        itemData={itemData}
        initialScrollOffset={scrollOffset}
        onScroll={onScroll}
      >
        {Row}
      </VariableSizeList>
    </Pane>
  )
})

TableVirtualBody.propTypes = {
  /**
   * Composes the Pane component as the base.
   */
  ...Pane.propTypes,

  /**
   * Children needs to be an array of a single node.
   */
  children: PropTypes.oneOfType([PropTypes.arrayOf(PropTypes.node), PropTypes.node]),

  /**
   * Default height of each row.
   * 48 is the default height of a TableRow.
   */
  defaultHeight: PropTypes.number,

  /**
   * When true, support `height="auto"` on children being rendered.
   * This is somewhat of an expirmental feature.
   */
  allowAutoHeight: PropTypes.bool,

  /**
   * The overscanCount property passed to react-tiny-virtual-list.
   */
  overscanCount: PropTypes.number,

  /**
   * When passed, this is used as the `estimatedItemSize` in react-tiny-virtual-list.
   * Only when `allowAutoHeight` and`useAverageAutoHeightEstimation` are false.
   */
  estimatedItemSize: PropTypes.number,

  /**
   * When allowAutoHeight is true and this prop is true, the estimated height
   * will be computed based on the average height of auto height rows.
   */
  useAverageAutoHeightEstimation: PropTypes.bool,

  /**
   * The scrollToIndex property passed to react-tiny-virtual-list
   */
  scrollToIndex: PropTypes.number,
  /**
   * The scrollOffset property passed to react-tiny-virtual-list
   */
  scrollOffset: PropTypes.number,
  /**
   * The scrollToAlignment property passed to react-tiny-virtual-list
   */
  scrollToAlignment: PropTypes.oneOf(['start', 'center', 'end', 'auto']),
  /**
   * The onScroll callback passed to react-tiny-virtual-list
   */
  onScroll: PropTypes.func
}

export default TableVirtualBody
