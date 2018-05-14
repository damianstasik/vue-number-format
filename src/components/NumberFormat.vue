<script>
import {
  charIsNumber,
  escapeRegExp,
  fixLeadingZero,
  limitToScale,
  roundToPrecision,
  setCaretPosition,
  splitDecimal,
  findChangedIndex,
  clamp,
} from '../utils';

export default {
  name: 'NumberFormat',
  props: {
    thousandSeparator: {
      type: String,
      default: null,
    },
    decimalSeparator: {
      type: String,
      default: null,
    },
    decimalScale: {
      type: Number,
      default: null,
    },
    fixedDecimalScale: {
      type: Boolean,
      default: false,
    },
    prefix: {
      type: String,
      default: '',
    },
    suffix: {
      type: String,
      default: '',
    },
    format: {
      type: [String, Function],
      default: null,
    },
    mask: {
      type: [String, Array],
      default: null,
      validate: (value) => {
        if (value) {
          const maskAsStr = value === 'string' ? value : value.toString();

          if (maskAsStr.match(/\d/g)) {
            throw new Error(`Mask ${value} should not contain numeric character`);
          }
        }
      },
    },
    value: {
      type: [String, Number],
      default: '',
    },
    isNumericString: {
      type: Boolean,
      default: false,
    },
    allowNegative: {
      type: Boolean,
      default: true,
    },
    allowEmptyFormatting: {
      type: Boolean,
      default: false,
    },
    isAllowed: {
      type: Function,
      default: () => true,
    },
  },
  data() {
    return {
      init: false,
      formattedValue: '',
      rawValue: '',
      selectionBeforeInput: {
        selectionStart: 0,
        selectionEnd: 0,
      },
    };
  },
  methods: {
    setValues(formattedValue, rawValue = null) {
      this.formattedValue = formattedValue;
      this.rawValue = rawValue || this.removeFormatting(formattedValue);

      this.$emit('input', { formattedValue, rawValue: this.rawValue });
    },
    getFloatString(num = '') {
      const { decimalSeparator, decimalScale } = this;
      const numRegex = this.getNumberRegex(true);

      // remove negation for regex check
      const hasNegation = num[0] === '-';
      if (hasNegation) num = num.replace('-', '');

      // if decimal scale is zero remove decimal and number after decimalSeparator
      if (decimalSeparator && decimalScale === 0) {
        num = num.split(decimalSeparator)[0];
      }

      num = (num.match(numRegex) || []).join('').replace(decimalSeparator, '.');

      // remove extra decimals
      const firstDecimalIndex = num.indexOf('.');

      if (firstDecimalIndex !== -1) {
        num = `${num.substring(0, firstDecimalIndex)}.${num.substring(firstDecimalIndex + 1, num.length).replace(new RegExp(escapeRegExp(decimalSeparator), 'g'), '')}`;
      }

      // add negation back
      if (hasNegation) num = `-${num}`;

      return num;
    },
    getNumberRegex(g, ignoreDecimalSeparator) {
      const { decimalSeparator, format, decimalScale } = this;
      return new RegExp(`\\d${decimalSeparator && decimalScale !== 0 && !ignoreDecimalSeparator && !format ? `|${escapeRegExp(decimalSeparator)}` : ''}`, g ? 'g' : undefined);
    },
    getMaskAtIndex(index) {
      const { mask = ' ' } = this;
      if (typeof mask === 'string') {
        return mask;
      }

      return mask[index] || ' ';
    },
    setPatchedCaretPosition(el, caretPos, currentValue) {
      /* setting caret position within timeout of 0ms is required for mobile chrome,
      otherwise browser resets the caret position after we set it
      We are also setting it without timeout so that in
      normal browser we don't see the flickering */
      setCaretPosition(el, caretPos);
      setTimeout(() => {
        if (el.value === currentValue) setCaretPosition(el, caretPos);
      }, 0);
    },

    /* This keeps the caret within typing area so people can't type in between prefix or suffix */
    correctCaretPosition(value, caretPos, direction) {
      const { prefix, suffix, format } = this;

      // if value is empty return 0
      if (value === '') return 0;

      // caret position should be between 0 and value length
      caretPos = clamp(caretPos, 0, value.length);

      // in case of format as number limit between prefix and suffix
      if (!format) {
        const hasNegation = value[0] === '-';
        return clamp(caretPos, prefix.length + (hasNegation ? 1 : 0), value.length - suffix.length);
      }

      // in case if custom format method don't do anything
      if (typeof format === 'function') return caretPos;

      /* in case format is string find the closest # position from the caret position */

      // in case the caretPos have input value on it don't do anything
      if (format[caretPos] === '#' && charIsNumber(value[caretPos])) return caretPos;

      // if caretPos is just after input value don't do anything
      if (format[caretPos - 1] === '#' && charIsNumber(value[caretPos - 1])) return caretPos;

      // find the nearest caret position
      const firstHashPosition = format.indexOf('#');
      const lastHashPosition = format.lastIndexOf('#');

      // limit the cursor between the first # position and the last # position
      caretPos = clamp(caretPos, firstHashPosition, lastHashPosition + 1);

      const nextPos = format.substring(caretPos, format.length).indexOf('#');
      let caretLeftBound = caretPos;
      const caretRightBound = caretPos + (nextPos === -1 ? 0 : nextPos);

      // get the position where the last number is present
      while (caretLeftBound > firstHashPosition && (format[caretLeftBound] !== '#' || !charIsNumber(value[caretLeftBound]))) {
        caretLeftBound -= 1;
      }

      const goToLeft = !charIsNumber(value[caretRightBound])
    || (direction === 'left' && caretPos !== firstHashPosition)
    || (caretPos - caretLeftBound < caretRightBound - caretPos);

      if (goToLeft) {
      // check if number should be taken after the bound or after it
      // if number preceding a valid number keep it after
        return charIsNumber(value[caretLeftBound]) ? caretLeftBound + 1 : caretLeftBound;
      }

      return caretRightBound;
    },
    getCaretPosition(inputValue, formattedValue, caretPos) {
      const { format } = this;
      const stateValue = this.formattedValue;
      const numRegex = this.getNumberRegex(true);
      const inputNumber = (inputValue.match(numRegex) || []).join('');
      const formattedNumber = (formattedValue.match(numRegex) || []).join('');
      let j,
        i;

      j = 0;

      for (i = 0; i < caretPos; i++) {
        const currentInputChar = inputValue[i] || '';
        const currentFormatChar = formattedValue[j] || '';
        // no need to increase new cursor position if formatted value does not have those characters
        // case inputValue = 1a23 and formattedValue =  123
        if (!currentInputChar.match(numRegex) && currentInputChar !== currentFormatChar) continue;

        // When we are striping out leading zeros maintain the new cursor position
        // Case inputValue = 00023 and formattedValue = 23;
        if (currentInputChar === '0' && currentFormatChar.match(numRegex) && currentFormatChar !== '0' && inputNumber.length !== formattedNumber.length) continue;

        // we are not using currentFormatChar because j can change here
        while (currentInputChar !== formattedValue[j] && j < formattedValue.length) j++;
        j++;
      }

      if ((typeof format === 'string' && !stateValue)) {
      // set it to the maximum value so it goes after the last number
        j = formattedValue.length;
      }

      // correct caret position if its outside of editable area
      j = this.correctCaretPosition(formattedValue, j);

      return j;
    },
    removePrefixAndSuffix(val) {
      const { format, prefix, suffix } = this;

      // remove prefix and suffix
      if (!format && val) {
        const isNegative = val[0] === '-';

        // remove negation sign
        if (isNegative) val = val.substring(1, val.length);

        // remove prefix
        val = prefix && val.indexOf(prefix) === 0 ? val.substring(prefix.length, val.length) : val;

        // remove suffix
        const suffixLastIndex = val.lastIndexOf(suffix);
        val = suffix && suffixLastIndex !== -1 && suffixLastIndex === val.length - suffix.length ? val.substring(0, suffixLastIndex) : val;

        // add negation sign back
        if (isNegative) val = `-${val}`;
      }

      return val;
    },
    removePatternFormatting(val) {
      const { format } = this;
      const formatArray = format.split('#').filter(str => str !== '');
      let start = 0;
      let numStr = '';

      for (let i = 0, ln = formatArray.length; i <= ln; i++) {
        const part = formatArray[i] || '';

        // if i is the last fragment take the index of end of the value
        // For case like +1 (911) 911 91 91 having pattern +1 (###) ### ## ##
        const index = i === ln ? val.length : val.indexOf(part, start);

        /* in any case if we don't find the pattern part in the value assume the val as numeric string
      This will be also in case if user has started typing, in any other case it will not be -1
      unless wrong prop value is provided */
        if (index === -1) {
          numStr = val;
          break;
        } else {
          numStr += val.substring(start, index);
          start = index + part.length;
        }
      }

      return (numStr.match(/\d/g) || []).join('');
    },
    removeFormatting(val) {
      const { format, removeFormatting } = this;
      if (!val) return val;

      if (!format) {
        val = this.removePrefixAndSuffix(val);
        val = this.getFloatString(val);
      } else if (typeof format === 'string') {
        val = this.removePatternFormatting(val);
      } else if (typeof removeFormatting === 'function') { // condition need to be handled if format method is provide,
        val = removeFormatting(val);
      } else {
        val = (val.match(/\d/g) || []).join('');
      }
      return val;
    },
    /**
     * Format when # based string is provided
     * @param  {string} numStr Numeric String
     * @return {string}        formatted Value
     */
    formatWithPattern(numStr) {
      const { format } = this;
      let hashCount = 0;
      const formattedNumberAry = format.split('');
      for (let i = 0, ln = format.length; i < ln; i++) {
        if (format[i] === '#') {
          formattedNumberAry[i] = numStr[hashCount] || this.getMaskAtIndex(hashCount);
          hashCount += 1;
        }
      }
      return formattedNumberAry.join('');
    },
    /**
     * @param  {string} numStr Numeric string/floatString] It always have decimalSeparator as .
     * @return {string} formatted Value
     */
    formatAsNumber(numStr) {
      const {
        thousandSeparator, decimalSeparator, decimalScale, fixedDecimalScale, prefix, suffix, allowNegative,
      } = this;

      const hasDecimalSeparator = numStr.indexOf('.') !== -1 || (decimalScale && fixedDecimalScale);
      let { beforeDecimal, afterDecimal, addNegation } = splitDecimal(numStr, allowNegative); // eslint-disable-line prefer-const

      // apply decimal precision if its defined
      if (decimalScale !== undefined) afterDecimal = limitToScale(afterDecimal, decimalScale, fixedDecimalScale);

      if (thousandSeparator) {
        beforeDecimal = beforeDecimal.replace(/(\d)(?=(\d{3})+(?!\d))/g, `$1${thousandSeparator}`);
      }

      // add prefix and suffix
      if (prefix) beforeDecimal = prefix + beforeDecimal;
      if (suffix) afterDecimal += suffix;

      // restore negation sign
      if (addNegation) beforeDecimal = `-${beforeDecimal}`;

      numStr = beforeDecimal + (hasDecimalSeparator && decimalSeparator || '') + afterDecimal;

      return numStr;
    },
    formatNumString(value = '') {
      const { format, allowEmptyFormatting } = this;
      let formattedValue = value;

      if (value === '' && !allowEmptyFormatting) {
        formattedValue = '';
      } else if (value === '-' && !format) {
        formattedValue = '-';
        value = '';
      } else if (typeof format === 'string') {
        formattedValue = this.formatWithPattern(formattedValue);
      } else if (typeof format === 'function') {
        formattedValue = format(formattedValue);
      } else {
        formattedValue = this.formatAsNumber(formattedValue);
      }

      return formattedValue;
    },
    formatValueProp() {
      const {
        format, decimalScale, fixedDecimalScale, allowEmptyFormatting,
      } = this;
      let { value, isNumericString } = this;

      if (value === undefined && allowEmptyFormatting) {
        value = '';
      }

      // if value is not defined return empty string
      if (value === undefined && !allowEmptyFormatting) return '';

      if (typeof value === 'number') {
        value = value.toString();
        isNumericString = true;
      }

      // round the number based on decimalScale
      // format only if non formatted value is provided
      if (isNumericString && !format && typeof decimalScale === 'number') {
        value = roundToPrecision(value, decimalScale, fixedDecimalScale);
      }

      const formattedValue = isNumericString ? this.formatNumString(value) : this.formatInput(value);

      return formattedValue;
    },
    formatNegation(value = '') {
      const { allowNegative } = this;
      const negationRegex = new RegExp('(-)');
      const doubleNegationRegex = new RegExp('(-)(.)*(-)');

      // Check number has '-' value
      const hasNegation = negationRegex.test(value);

      // Check number has 2 or more '-' values
      const removeNegation = doubleNegationRegex.test(value);

      // remove negation
      value = value.replace(/-/g, '');

      if (hasNegation && !removeNegation && allowNegative) {
        value = `-${value}`;
      }

      return value;
    },
    formatInput(value = '') {
      const { format } = this;

      // format negation only if we are formatting as number
      if (!format) {
        value = this.formatNegation(value);
      }

      // remove formatting from number
      value = this.removeFormatting(value);

      return this.formatNumString(value);
    },
    isCharacterAFormat(caretPos, value) {
      const {
        decimalSeparator, format, prefix, suffix, decimalScale, fixedDecimalScale,
      } = this;

      // check within format pattern
      if (typeof format === 'string' && format[caretPos] !== '#') return true;

      // check in number format
      if (!format && (caretPos < prefix.length
      || caretPos >= value.length - suffix.length
      || (decimalScale && fixedDecimalScale && value[caretPos] === decimalSeparator))
      ) {
        return true;
      }

      return false;
    },
    checkIfFormatGotDeleted(start, end, value) {
      for (let i = start; i < end; i++) {
        if (this.isCharacterAFormat(i, value)) return true;
      }
      return false;
    },
    /**
     * This will check if any formatting got removed by the delete or backspace and reset the value
     * It will also work as fallback if android chome keyDown handler does not work
     * */
    correctInputValue(caretPos, lastValue, value) {
      const { format, decimalSeparator, allowNegative } = this;
      const lastNumStr = this.rawValue || '';
      const { selectionStart, selectionEnd } = this.selectionBeforeInput;
      const { start, end } = findChangedIndex(lastValue, value);

      /* don't do anyhting if something got added,
     or if value is empty string (when whole input is cleared)
     or whole input is replace with a number
    */
      if (
        value.length > lastValue.length
      || !value.length ||
      start === end ||
      (start === 0 && end === lastValue.length) ||
      (selectionStart === 0 && selectionEnd === lastValue.length)
      ) {
        return value;
      }

      // if format got deleted reset the value to last value
      if (this.checkIfFormatGotDeleted(start, end, lastValue)) {
        value = lastValue;
      }

      // for numbers check if beforeDecimal got deleted and there is nothing after decimal,
      // clear all numbers in such case while keeping the - sign
      if (!format) {
        const numericString = this.removeFormatting(value);
        let { beforeDecimal, afterDecimal, addNegation } = splitDecimal(numericString, allowNegative); // eslint-disable-line prefer-const

        // clear only if something got deleted
        const isBeforeDecimalPoint = caretPos < value.indexOf(decimalSeparator) + 1;
        if (numericString.length < lastNumStr.length && isBeforeDecimalPoint && beforeDecimal === '' && !parseFloat(afterDecimal)) {
          return addNegation ? '-' : '';
        }
      }

      return value;
    },
    onChange(e) {
      const el = e.target;
      let inputValue = el.value;
      const { isAllowed } = this;
      const lastValue = this.formattedValue || '';

      /* Max of selectionStart and selectionEnd is taken for the patch of pixel and other mobile device caret bug */
      const currentCaretPosition = Math.max(el.selectionStart, el.selectionEnd);

      inputValue = this.correctInputValue(currentCaretPosition, lastValue, inputValue);

      let formattedValue = this.formatInput(inputValue) || '';

      const valueObj = {
        formattedValue,
        rawValue: this.removeFormatting(formattedValue),
      };

      if (!isAllowed(valueObj)) {
        formattedValue = lastValue;
      }

      // set the value imperatively, this is required for IE fix
      // el.value = formattedValue;

      // get the caret position
      const caretPos = this.getCaretPosition(inputValue, formattedValue, currentCaretPosition);

      // set caret position
      this.setPatchedCaretPosition(el, caretPos, formattedValue);

      // change the state
      this.setValues(formattedValue);

      this.$forceUpdate();
    },
    onBlur(e) {
      const { format } = this;
      let { rawValue } = this;
      const lastValue = this.formattedValue;
      if (!format) {
        rawValue = fixLeadingZero(rawValue);
        const formattedValue = this.formatNumString(rawValue);

        // change the state
        if (formattedValue !== lastValue) {
          this.setValues(formattedValue, rawValue);
        }
      }

      this.onEvent('blur', e);
    },
    onKeyDown(e) {
      const el = e.target;
      const { key } = e;

      const { selectionStart, selectionEnd, value = '' } = el;
      let expectedCaretPosition;
      const {
        decimalScale, fixedDecimalScale, prefix, suffix, format,
      } = this;
      const ignoreDecimalSeparator = decimalScale !== undefined && fixedDecimalScale;
      const numRegex = this.getNumberRegex(false, ignoreDecimalSeparator);
      const negativeRegex = new RegExp('-');
      const isPatternFormat = typeof format === 'string';

      this.selectionBeforeInput = {
        selectionStart,
        selectionEnd,
      };

      // Handle backspace and delete against non numerical/decimal characters or arrow keys
      if (key === 'ArrowLeft' || key === 'Backspace') {
        expectedCaretPosition = selectionStart - 1;
      } else if (key === 'ArrowRight') {
        expectedCaretPosition = selectionStart + 1;
      } else if (key === 'Delete') {
        expectedCaretPosition = selectionStart;
      }

      // if expectedCaretPosition is not set it means we don't want to Handle keyDown
      // also if multiple characters are selected don't handle
      if (expectedCaretPosition === undefined || selectionStart !== selectionEnd) {
        this.onEvent('keydown', e);
        return;
      }

      let newCaretPosition = expectedCaretPosition;
      const leftBound = isPatternFormat ? format.indexOf('#') : prefix.length;
      const rightBound = isPatternFormat ? format.lastIndexOf('#') + 1 : value.length - suffix.length;

      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const direction = key === 'ArrowLeft' ? 'left' : 'right';
        newCaretPosition = this.correctCaretPosition(value, expectedCaretPosition, direction);
      } else if (key === 'Delete' && !numRegex.test(value[expectedCaretPosition]) && !negativeRegex.test(value[expectedCaretPosition])) {
        while (!numRegex.test(value[newCaretPosition]) && newCaretPosition < rightBound) newCaretPosition++;
      } else if (key === 'Backspace' && !numRegex.test(value[expectedCaretPosition]) && !negativeRegex.test(value[expectedCaretPosition])) {
        while (!numRegex.test(value[newCaretPosition - 1]) && newCaretPosition > leftBound) { newCaretPosition--; }
        newCaretPosition = this.correctCaretPosition(value, newCaretPosition, 'left');
      }

      if (newCaretPosition !== expectedCaretPosition || expectedCaretPosition < leftBound || expectedCaretPosition > rightBound) {
        e.preventDefault();
        this.setPatchedCaretPosition(el, newCaretPosition, value);
      }

      this.onEvent('keydown', e);
    },
    /** required to handle the caret position when click anywhere within the input * */
    onMouseUp(e) {
      const el = e.target;

      /**
     * NOTE: we have to give default value for value as in case when custom input is provided
     * value can come as undefined when nothing is provided on value prop.
    */
      const { selectionStart, selectionEnd, value = '' } = el;

      if (selectionStart === selectionEnd) {
        const caretPosition = this.correctCaretPosition(value, selectionStart);
        if (caretPosition !== selectionStart) {
          this.setPatchedCaretPosition(el, caretPosition, value);
        }
      }

      this.onEvent('mouseup', e);
    },
    onFocus(e) {
    // Workaround Chrome and Safari bug https://bugs.chromium.org/p/chromium/issues/detail?id=779328
    // (onFocus event target selectionStart is always 0 before setTimeout)
      setTimeout(() => {
        const el = e.target;
        const { selectionStart, value = '' } = el;

        const caretPosition = this.correctCaretPosition(value, selectionStart);
        if (caretPosition !== selectionStart) {
          this.setPatchedCaretPosition(el, caretPosition, value);
        }

        this.onEvent('focus', e);
      }, 0);
    },
    onEvent(name, value) {
      if (this.$listeners[name]) {
        this.$listeners[name](value);

        this.init = true;
      }
    }
  },
  render() {
    let formattedValue = this.formattedValue;
    let rawValue = this.rawValue;

    if (!this.init) {
      formattedValue = this.formatValueProp();
      rawValue = this.removeFormatting(formattedValue);
    }

    return this.$scopedSlots.default({
      formattedValue,
      rawValue,
      inputEvents: {
        input: this.onChange,
        keydown: this.onKeyDown,
        mouseup: this.onMouseUp,
        focus: this.onFocus,
        blur: this.onBlur,
      },
    });
  },
};
</script>
