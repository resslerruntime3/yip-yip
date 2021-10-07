import React from 'react';
import "../content.css";

import useWindowEvent from "../hooks/use_window_event.js";
import useDocumentEvent from "../hooks/use_document_event.js";
import useHighlights from "../hooks/use_highlights.js";
import useKeyboardShortcuts from "../hooks/use_keyboard_shortcuts.js";
import useStoredSettings from "../hooks/use_stored_settings.js";
import useUrlChangeSubscription from "../hooks/use_url_change_subscription.js";

import Utils from "../lib/utils.js";
import FindInPage from "../lib/find_in_page.js";
import SearchInput from "./search_input.js";
import Selections from "./selections.js";
import MatchesSummary from "./matches_summary.js";
import DraggableContainer from "./draggable_container.js";
import InfoDropdown from "./info_dropdown.js";
import VisibilityButton from "./visibility_button.js";

const SCROLL_OR_RESIZE_UPDATE_TIMEOUT_DURATION = 100;
const SEARCH_TEXT_UPDATE_TIMEOUT_DURATION = 150;

const YipYip = (props) => {
  const scrollOrResizeUpdateTimeout = React.useRef();
  const selectionUpdateTimeout = React.useRef();
  const containerRef = React.useRef();
  const searchInputRef = React.useRef();

  const { host } = useUrlChangeSubscription()
  const [prevHost, setPrevHost] = React.useState(host);

  const {
    autoHide,
    updateAutoHide,
    useOnEveryWebsite,
    updateUseOnEveryWebsite
  } = useStoredSettings()

  const [isHidden, setIsHidden] = React.useState(autoHide);
  const [prevAutoHide, setPrevAutoHide] = React.useState(autoHide);
  const [isDisabled, setIsDisabled] = React.useState(!useOnEveryWebsite);
  const [prevUseOnEveryWebsite, setPrevUseOnEveryWebsite] = React.useState(useOnEveryWebsite);
  const [searchText, setSearchText] = React.useState('');
  const [prevSearchText, setPrevSearchText] = React.useState('');
  const [matchingNodes, setMatchingNodes] = React.useState([]);
  const [matchingLinksAndButtons, setMatchingLinksAndButtons] = React.useState([]);
  const [selectedSelectionIndex, setSelectedSelectionIndex] = React.useState(0);
  const [scrollOrResizeRefresh, setScrollOrResizeRefresh] = React.useState(false);
  const [hideSelections, setHideSelections] = React.useState(false);

  const focusSearchInput = React.useCallback(() => {
    if (!isDisabled) {
      searchInputRef.current.focus()
    }
  }, [isDisabled])

  const clearMatchingNodes = React.useCallback(() => {
    setMatchingNodes([])
    setMatchingLinksAndButtons([])
  }, [])

  const resetSearchTextAndMatches = React.useCallback(event => {
    setSearchText('')
    clearMatchingNodes()
    setSelectedSelectionIndex(0)
  }, [clearMatchingNodes])

  const hide = React.useCallback(() => {
    setIsHidden(true)
    resetSearchTextAndMatches()
  }, [resetSearchTextAndMatches])

  const handleBlur = React.useCallback(event => {
    if (autoHide) {
      setIsHidden(true)
    }
    resetSearchTextAndMatches()
  }, [autoHide, resetSearchTextAndMatches])

  const clickSelectedMatchingNodeAndReset = React.useCallback(event => {
    if (matchingLinksAndButtons.length > 0) {
      event.preventDefault()
      event.stopPropagation()

      const node = matchingLinksAndButtons[selectedSelectionIndex];
      Utils.clickOrFocusNode(node)

      if (autoHide) {
        setIsHidden(true)
      }
      resetSearchTextAndMatches()
    }
  }, [matchingLinksAndButtons, selectedSelectionIndex, resetSearchTextAndMatches, autoHide])

  const updateMatchingNodesAndScrollToSelectedIndex = React.useCallback(selectedIndex => {
    const { matchingNodes, matchingLinksAndButtons, bestMatchingLinkOrButtonIndex } = new FindInPage(searchText).findMatches();
    setMatchingNodes(matchingNodes)
    setMatchingLinksAndButtons(matchingLinksAndButtons)
    setSelectedSelectionIndex(bestMatchingLinkOrButtonIndex)

    if (matchingLinksAndButtons.length > 0) {
      Utils.scrollToNodeAtIndexInList(matchingLinksAndButtons, bestMatchingLinkOrButtonIndex)
      setScrollOrResizeRefresh(!scrollOrResizeRefresh)
    }
  }, [searchText, scrollOrResizeRefresh])

  const updateSelectionPositionsAfterTimeout = React.useCallback(() => {
    setHideSelections(true)
    if (scrollOrResizeUpdateTimeout.current) { clearTimeout(scrollOrResizeUpdateTimeout.current) }
    scrollOrResizeUpdateTimeout.current = setTimeout(() => {
      setScrollOrResizeRefresh(!scrollOrResizeRefresh)
      setHideSelections(false)
    }, SCROLL_OR_RESIZE_UPDATE_TIMEOUT_DURATION)
  }, [scrollOrResizeRefresh])

  const updateSelectionAndScrollToSelectedAfterTimeout = React.useCallback(() => {
    if (selectionUpdateTimeout.current) { clearTimeout(selectionUpdateTimeout.current) }
    clearMatchingNodes()

    selectionUpdateTimeout.current = setTimeout(() => {
      updateMatchingNodesAndScrollToSelectedIndex();
    }, SEARCH_TEXT_UPDATE_TIMEOUT_DURATION)
  }, [clearMatchingNodes, updateMatchingNodesAndScrollToSelectedIndex])

  const preventDefaultEventAndSelectNextMatchingNode = React.useCallback((event, forward=true) => {
    event.preventDefault();
    event.stopPropagation();

    if (matchingLinksAndButtons.length > 1) {
      const newSelectedSelectionIndex = (selectedSelectionIndex + (forward ? 1 : (matchingLinksAndButtons.length-1))) % matchingLinksAndButtons.length;
      setSelectedSelectionIndex(newSelectedSelectionIndex)
      Utils.scrollToNodeAtIndexInList(matchingLinksAndButtons, newSelectedSelectionIndex)
      setScrollOrResizeRefresh(!scrollOrResizeRefresh)
    }
  }, [matchingLinksAndButtons, selectedSelectionIndex, scrollOrResizeRefresh])

  const preventDefaultAndClearSearchText = React.useCallback(event => {
    event.preventDefault();
    event.stopPropagation();
    setSearchText('')
  }, [])

  const handleNextMatchShortcut = React.useCallback(event => {
    const differentInputIsActive = Utils.differentInputIsActive(searchInputRef.current);
    if (!isHidden && !isDisabled && (document.activeElement === searchInputRef.current || !differentInputIsActive)) {
      preventDefaultEventAndSelectNextMatchingNode(event)
    }
  }, [isHidden, isDisabled, preventDefaultEventAndSelectNextMatchingNode])

  const handlePreviousMatchShortcut = React.useCallback(event => {
    const differentInputIsActive = Utils.differentInputIsActive(searchInputRef.current);
    if (!isHidden && !isDisabled && (document.activeElement === searchInputRef.current || !differentInputIsActive)) {
      preventDefaultEventAndSelectNextMatchingNode(event, false)
    }
  }, [isHidden, isDisabled, preventDefaultEventAndSelectNextMatchingNode])

  const handleSelectShortcut = React.useCallback(event => {
    if (!isDisabled && !isHidden) {
      clickSelectedMatchingNodeAndReset(event)
    }
  }, [isHidden, isDisabled, clickSelectedMatchingNodeAndReset])

  const handleClearShortcut = React.useCallback(event => {
    const differentInputIsActive = Utils.differentInputIsActive(searchInputRef.current);
    if (!isDisabled && !isHidden && !differentInputIsActive) {
      preventDefaultAndClearSearchText(event)
    }
  }, [isHidden, isDisabled, preventDefaultAndClearSearchText])

  const handleFocusShortcut = React.useCallback(event => {
    if (!isDisabled) {
      setIsHidden(false)
      event.preventDefault();
      event.stopPropagation();
      focusSearchInput();
    }
  }, [focusSearchInput, isDisabled])

  const toggleUseOnEveryWebsite = React.useCallback(() => {
    updateUseOnEveryWebsite(!useOnEveryWebsite)
  }, [useOnEveryWebsite, updateUseOnEveryWebsite])

  const toggleAutoHide = React.useCallback(() => {
    updateAutoHide(!autoHide)
  }, [autoHide, updateAutoHide])

  const handleToggleAutohideShortcut = React.useCallback(event => {
    event.preventDefault()
    toggleAutoHide()
  }, [toggleAutoHide])

  const keyboardShortcutHandlerMapping = React.useMemo(() => {
    return {
      "next_match": handleNextMatchShortcut,
      "previous_match": handlePreviousMatchShortcut,
      "select_match": handleSelectShortcut,
      "clear_searchbar": handleClearShortcut,
      "focus_searchbar": handleFocusShortcut,
      "toggle_autohide": handleToggleAutohideShortcut
    }
  }, [handleNextMatchShortcut, handlePreviousMatchShortcut, handleSelectShortcut,
    handleClearShortcut, handleFocusShortcut, handleToggleAutohideShortcut
  ])

  const handleShortcut = React.useCallback((keyboardShortcutName, event) => {
    const keyboardEventHandler = keyboardShortcutHandlerMapping[keyboardShortcutName]
    if (keyboardEventHandler) {
      keyboardEventHandler(event)
    }
  }, [keyboardShortcutHandlerMapping])

  const handleKeydown = React.useCallback(event => {
    const differentInputIsActive = Utils.differentInputIsActive(searchInputRef.current);
    if (!differentInputIsActive && Utils.keyValidForFocus(event.key) && !event.metaKey && !event.altKey) {
      setIsHidden(false)
      focusSearchInput()
    }
  }, [focusSearchInput])

  React.useEffect(() => {
    if (searchText !== prevSearchText) {
      setPrevSearchText(searchText)
      updateSelectionAndScrollToSelectedAfterTimeout()
    }
  }, [searchText, prevSearchText, updateSelectionAndScrollToSelectedAfterTimeout])

  React.useEffect(() => {
    if (autoHide !== prevAutoHide) {
      setPrevAutoHide(autoHide)

      if (autoHide) {
        hide()
      } else {
        setIsHidden(false)
        focusSearchInput()
      }
    }
  }, [autoHide, prevAutoHide, hide, focusSearchInput])

  React.useEffect(() => {
    const useOnEveryWebsiteChanged = useOnEveryWebsite !== prevUseOnEveryWebsite;
    if (useOnEveryWebsiteChanged) {
      setPrevUseOnEveryWebsite(useOnEveryWebsite)
    }

    const hostChanged = host !== prevHost;
    if (hostChanged) {
      setPrevHost(host)
    }

    if (useOnEveryWebsiteChanged || hostChanged) {
      const newIsDisabled = !useOnEveryWebsite && !Utils.hostIsGmail();
      setIsDisabled(newIsDisabled)
      if (newIsDisabled) {
        resetSearchTextAndMatches()
      }
    }
  }, [useOnEveryWebsite, prevUseOnEveryWebsite, resetSearchTextAndMatches, host, prevHost])

  const hasMatchingLinksOrButtons = React.useMemo(() => matchingLinksAndButtons.length > 0, [matchingLinksAndButtons])
  useWindowEvent('scroll', !isDisabled && !isHidden && hasMatchingLinksOrButtons, updateSelectionPositionsAfterTimeout)
  useWindowEvent('wheel', !isDisabled && !isHidden && hasMatchingLinksOrButtons, updateSelectionPositionsAfterTimeout)
  useWindowEvent('resize', !isDisabled && !isHidden && hasMatchingLinksOrButtons, updateSelectionPositionsAfterTimeout)
  useDocumentEvent('keydown', !isDisabled, handleKeydown)
  useKeyboardShortcuts(handleShortcut)
  useHighlights({ searchText, matchingNodes })

  return (
    <div class={(isDisabled || isHidden) ? 'yipyip-hidden' : ''}>
      { !hideSelections && <Selections
          refresh={scrollOrResizeRefresh}
          selectedSelectionIndex={selectedSelectionIndex}
          matchingLinksAndButtons={matchingLinksAndButtons}
        />
      }
      <DraggableContainer containerRef={containerRef} searchInputRef={searchInputRef}>
        <SearchInput
          inputRef={searchInputRef}
          searchText={searchText}
          onBlur={handleBlur}
          updateSearchText={setSearchText}
        />
        <MatchesSummary
          selectedSelectionIndex={selectedSelectionIndex}
          matchingLinksAndButtons={matchingLinksAndButtons}
        />
        <VisibilityButton
          autoHide={autoHide}
          toggleAutoHide={toggleAutoHide}
        />
        <InfoDropdown
          autoHide={autoHide}
          toggleAutoHide={toggleAutoHide}
          useOnEveryWebsite={useOnEveryWebsite}
          toggleUseOnEveryWebsite={toggleUseOnEveryWebsite}
        />
      </DraggableContainer>
    </div>
  )
}

export default YipYip;
