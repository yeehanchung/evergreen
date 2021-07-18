import React, { memo, useRef, useState, useLayoutEffect, useMemo, useCallback } from 'react'
import PropTypes from 'prop-types'
import { useLatest } from '../../hooks'
import { Textarea } from '../../textarea'

function getTableBodyRef(refGetterFn) {
  let ref = refGetterFn()

  if (!ref) return

  while (ref) {
    const isTableBody = ref.hasAttribute('data-evergreen-table-body')
    if (isTableBody) {
      return ref
    }

    if (ref.parentElement) {
      ref = ref.parentElement
    } else {
      return null
    }
  }

  return ref
}

const EditableCellField = memo(function EditableCellField(props) {
  const { minHeight = 40, minWidth = 80, size, value, zIndex } = props

  const latestAnimationFrame = useRef()
  const textareaRef = useRef()
  const tableBodyRef = useRef()
  const onCancel = useLatest(props.onCancel)
  const getTargetRef = useLatest(props.getTargetRef)
  const onChangeComplete = useLatest(props.onChangeComplete)
  const [{ height, left, top, width }, setDimensions] = useState({
    top: 0,
    left: 0,
    height: 0,
    width: 0
  })

  const update = useCallback(() => {
    function updater() {
      const targetRef = getTargetRef.current()
      if (!targetRef) return
      tableBodyRef.current = getTableBodyRef(getTargetRef.current)

      const {
        height: targetHeight,
        left: targetLeft,
        top: targetTop,
        width: targetWidth
      } = targetRef.getBoundingClientRect()

      let calculatedTop
      if (tableBodyRef.current) {
        const bounds = tableBodyRef.current.getBoundingClientRect()
        calculatedTop = Math.min(Math.max(targetTop, bounds.top), bounds.bottom - targetHeight)
      } else {
        calculatedTop = targetTop
      }

      setDimensions({
        top: calculatedTop,
        left: targetLeft,
        height: targetHeight,
        width: targetWidth
      })

      // recursively run the updater
      latestAnimationFrame.current = requestAnimationFrame(() => updater())
    }

    // kick off the updater
    updater()
    // getTargetRef is a ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mirrors functionality of componentDidMount and componentWillUnmount.
  // Focus on mount
  useLayoutEffect(() => {
    // This only should get called ONCE
    update()

    const requestId = requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
      }
    })

    const cancel = onCancel.current

    return () => {
      cancelAnimationFrame(requestId)
      cancelAnimationFrame(latestAnimationFrame.current)
      cancel()
    }
    // onCancel is a ref and `update` should intentionally fire on mount
    // we don't care about firing it again on update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFocus = useCallback(e => {
    e.target.selectionStart = e.target.value.length
  }, [])

  const handleBlur = useCallback(() => {
    if (textareaRef.current && typeof onChangeComplete.current === 'function') {
      onChangeComplete.current(textareaRef.current.value)
    }
    // onChangeComplete is a ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleKeyDown = useCallback(e => {
    switch (e.key) {
      case 'Escape':
        if (typeof onCancel.current === 'function') onCancel.current()
        if (textareaRef.current) textareaRef.current.blur()
        break
      case 'Enter':
        if (textareaRef.current) textareaRef.current.blur()
        e.preventDefault()
        break
      case 'Tab':
        if (textareaRef.current) textareaRef.current.blur()
        break
      default:
        break
    }
    // onCancel is a ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const style = useMemo(
    () => ({
      left,
      top,
      height,
      minHeight: Math.max(height, minHeight),
      width,
      minWidth: Math.max(width, minWidth),
      zIndex
    }),
    [left, top, height, minHeight, width, minWidth, zIndex]
  )

  return (
    <Textarea
      ref={textareaRef}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      onFocus={handleFocus}
      appearance="editable-cell"
      size={size}
      style={style}
      height={null}
      width={null}
      minHeight={null}
      position="fixed"
      defaultValue={value}
    />
  )
})

EditableCellField.propTypes = {
  /**
   * Used as the defaultValue of the textarea.
   */
  value: PropTypes.string.isRequired,

  /**
   * The z-index placed on the element.
   */
  zIndex: PropTypes.number.isRequired,

  /**
   * Function to get the target ref of the parent.
   * Used to mirror the position.
   */
  getTargetRef: PropTypes.func.isRequired,

  /**
   * Min width of the textarea.
   * The textarea can never be smaller than the cell.
   */
  minWidth: PropTypes.number,

  /**
   * Min height of the textarea.
   * The textarea can never be smaller than the cell.
   */
  minHeight: PropTypes.number,

  /**
   * Called when the textarea is blurred, pass the value back to the cell.
   */
  onChangeComplete: PropTypes.func.isRequired,

  /**
   * Called when Escape is hit or componentWillUnmount.
   */
  onCancel: PropTypes.func.isRequired,

  /**
   * Text size of the textarea.
   */
  size: PropTypes.number
}

export default EditableCellField
