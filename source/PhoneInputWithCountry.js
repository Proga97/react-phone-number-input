import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'

import InputSmart from './InputSmart'
import InputBasic from './InputBasic'

import Flag from './Flag'
import InternationalIcon from './InternationalIcon'

import {
	sortCountryOptions,
	isCountrySupportedWithError,
	getSupportedCountries,
	getSupportedCountryOptions,
	getCountries
} from './helpers/countries'

import { createCountryIconComponent } from './CountryIcon'

import {
	metadata as metadataPropType,
	labels as labelsPropType
} from './PropTypes'

import {
	getPreSelectedCountry,
	getCountrySelectOptions,
	parsePhoneNumber,
	generateNationalNumberDigits,
	getPhoneDigitsForNewCountry,
	getInitialPhoneDigits,
	onPhoneDigitsChange,
	e164
} from './helpers/phoneInputHelpers'

import getPhoneInputWithCountryStateUpdateFromNewProps from './helpers/getPhoneInputWithCountryStateUpdateFromNewProps'

class PhoneNumberInput_ extends React.PureComponent {
	inputRef = React.createRef()

	constructor(props) {
		super(props)

		const {
			value,
			labels,
			international,
			addInternationalOption,
			// `displayInitialValueAsLocalNumber` property has been
			// superceded by `initialValueFormat` property.
			displayInitialValueAsLocalNumber,
			initialValueFormat,
			metadata
		} = this.props

		let {
			defaultCountry,
			countries
		} = this.props

		// Validate `defaultCountry`.
		if (defaultCountry) {
			if (!this.isCountrySupportedWithError(defaultCountry)) {
				defaultCountry = undefined
			}
		}

		// Validate `countries`.
		countries = getSupportedCountries(countries, metadata)

		const phoneNumber = parsePhoneNumber(value, metadata)

		this.CountryIcon = createCountryIconComponent(this.props)

		this.state = {
			// Workaround for `this.props` inside `getDerivedStateFromProps()`.
			props: this.props,

			// The country selected.
			country: getPreSelectedCountry({
				phoneNumber,
				defaultCountry,
				countries: countries || getCountries(metadata),
				required: !addInternationalOption,
				metadata
			}),

			// `countries` are stored in `this.state` because they're filtered.
			// For example, a developer might theoretically pass some unsupported
			// countries as part of the `countries` property, and because of that
			// the component uses `this.state.countries` (which are filtered)
			// instead of `this.props.countries`
			// (which could potentially contain unsupported countries).
			countries,

			// `phoneDigits` state property holds non-formatted user's input.
			// The reason is that there's no way of finding out
			// in which form should `value` be displayed: international or national.
			// E.g. if `value` is `+78005553535` then it could be input
			// by a user both as `8 (800) 555-35-35` and `+7 800 555 35 35`.
			// Hence storing just `value` is not sufficient for correct formatting.
			// E.g. if a user entered `8 (800) 555-35-35`
			// then value is `+78005553535` and `phoneDigits` are `88005553535`
			// and if a user entered `+7 800 555 35 35`
			// then value is `+78005553535` and `phoneDigits` are `+78005553535`.
			phoneDigits: getInitialPhoneDigits({
				value,
				phoneNumber,
				defaultCountry,
				international,
				useNationalFormat: displayInitialValueAsLocalNumber || initialValueFormat === 'national',
				metadata
			}),

			// `value` property is duplicated in state.
			// The reason is that `getDerivedStateFromProps()`
			// needs this `value` to compare to the new `value` property
			// to find out if `phoneDigits` needs updating:
			// If the `value` property was changed externally
			// then it won't be equal to `state.value`
			// in which case `phoneDigits` and `country` should be updated.
			value
		}
	}

	componentDidMount() {
		const { onCountryChange } = this.props
		let { defaultCountry } = this.props
		const { country: selectedCountry } = this.state
		if (onCountryChange) {
			if (defaultCountry) {
				if (!this.isCountrySupportedWithError(defaultCountry)) {
					defaultCountry = undefined
				}
			}
			if (selectedCountry !== defaultCountry) {
				onCountryChange(selectedCountry)
			}
		}
	}

	componentDidUpdate(prevProps, prevState) {
		const { onCountryChange } = this.props
		const { country } = this.state
		// Call `onCountryChange` when user selects another country.
		if (onCountryChange && country !== prevState.country) {
			onCountryChange(country)
		}
	}

	// A shorthand for not passing `metadata` as a second argument.
	isCountrySupportedWithError = (country) => {
		const { metadata } = this.props
		return isCountrySupportedWithError(country, metadata)
	}

	// Country `<select/>` `onChange` handler.
	onCountryChange = (newCountry) => {
		const {
			international,
			metadata,
			onChange,
			focusInputOnCountrySelection
		} = this.props

		const {
			phoneDigits: prevPhoneDigits,
			country: prevCountry
		} = this.state

		// After the new `country` has been selected,
		// if the phone number `<input/>` holds any digits
		// then migrate those digits for the new `country`.
		const newPhoneDigits = getPhoneDigitsForNewCountry(prevPhoneDigits, {
			prevCountry,
			newCountry,
			metadata,
			// Convert the phone number to "national" format
			// when the user changes the selected country by hand.
			useNationalFormat: !international
		})

		const newValue = e164(newPhoneDigits, newCountry, metadata)

		// Focus phone number `<input/>` upon country selection.
		if (focusInputOnCountrySelection) {
			this.getInputRef().current.focus()
		}

		// If the user has already manually selected a country
		// then don't override that already selected country
		// if the `defaultCountry` property changes.
		// That's what `hasUserSelectedACountry` flag is for.

		this.setState({
			country: newCountry,
			hasUserSelectedACountry: true,
			phoneDigits: newPhoneDigits,
			value: newValue
		},
		() => {
			// Update the new `value` property.
			// Doing it after the `state` has been updated
			// because `onChange()` will trigger `getDerivedStateFromProps()`
			// with the new `value` which will be compared to `state.value` there.
			onChange(newValue)
		})
	}

	/**
	 * `<input/>` `onChange()` handler.
	 * Updates `value` property accordingly (so that they are kept in sync).
	 * @param {string?} input — Either a parsed phone number or an empty string. Examples: `""`, `"+"`, `"+123"`, `"123"`.
	 */
	onChange = (_phoneDigits) => {
		const {
			defaultCountry,
			onChange,
			addInternationalOption,
			international,
			limitMaxLength,
			countryCallingCodeEditable,
			metadata
		} = this.props

		const {
			countries,
			phoneDigits: prevPhoneDigits,
			country: currentlySelectedCountry
		} = this.state

		const {
			phoneDigits,
			country,
			value
		} = onPhoneDigitsChange(_phoneDigits, {
			prevPhoneDigits,
			country: currentlySelectedCountry,
			defaultCountry,
			countries,
			international,
			limitMaxLength,
			countryCallingCodeEditable,
			metadata
		})

		const stateUpdate = {
			phoneDigits,
			value,
			country
		}

		if (countryCallingCodeEditable === false) {
			// If it simply did `setState({ phoneDigits: intlPrefix })` here,
			// then it would have no effect when erasing an inital international prefix
			// via Backspace, because `phoneDigits` in `state` wouldn't change
			// as a result, because it was `prefix` and it became `prefix`,
			// so the component wouldn't rerender, and the user would be able
			// to erase the country calling code part, and that part is
			// assumed to be non-eraseable. That's why the component is
			// forcefully rerendered here.
			// https://github.com/catamphetamine/react-phone-number-input/issues/367#issuecomment-721703501
			if (!value && phoneDigits === this.state.phoneDigits) {
				// Force a re-render of the `<input/>` in order to reset its value.
				stateUpdate.forceRerender = {}
			}
		}

		this.setState(
			stateUpdate,
			// Update the new `value` property.
			// Doing it after the `state` has been updated
			// because `onChange()` will trigger `getDerivedStateFromProps()`
			// with the new `value` which will be compared to `state.value` there.
			() => onChange(value)
		)
	}

	// Toggles the `--focus` CSS class.
	_onFocus = () => this.setState({ isFocused: true })

	// Toggles the `--focus` CSS class.
	_onBlur = () => this.setState({ isFocused: false })

	onFocus = (event) => {
		this._onFocus()
		const { onFocus } = this.props
		if (onFocus) {
			onFocus(event)
		}
	}

	onBlur = (event) => {
		const { onBlur } = this.props
		this._onBlur()
		if (onBlur) {
			onBlur(event)
		}
	}

	onCountryFocus = (event) => {
		this._onFocus()
		// this.setState({ countrySelectFocused: true })
		const { countrySelectProps } = this.props
		if (countrySelectProps) {
			const { onFocus } = countrySelectProps
			if (onFocus) {
				onFocus(event)
			}
		}
	}

	onCountryBlur = (event) => {
		this._onBlur()
		// this.setState({ countrySelectFocused: false })
		const { countrySelectProps } = this.props
		if (countrySelectProps) {
			const { onBlur } = countrySelectProps
			if (onBlur) {
				onBlur(event)
			}
		}
	}

	getInputRef() {
		const { inputRef } = this.props
		return inputRef || this.inputRef
	}

	// `state` holds previous props as `props`, and also:
	// * `country` — The currently selected country, e.g. `"RU"`.
	// * `value` — The currently entered phone number (E.164), e.g. `+78005553535`.
	// * `phoneDigits` — The parsed `<input/>` value, e.g. `8005553535`.
	// (and a couple of other less significant properties)
	static getDerivedStateFromProps(props, state) {
		return {
			// Emulate `prevProps` via `state.props`.
			props,
			...getPhoneInputWithCountryStateUpdateFromNewProps(props, state.props, state)
		}
	}

	render() {
		const {
			// Generic HTML attributes.
			name,
			disabled,
			autoComplete,
			style,
			className,

			// Number `<input/>` properties.
			inputRef,
			inputComponent,
			numberInputProps,
			smartCaret,

			// Country `<select/>` properties.
			countrySelectComponent: CountrySelectComponent,
			countrySelectProps,

			// Container `<div/>` properties.
			containerComponent: ContainerComponent,

			// Get "rest" properties (passed through to number `<input/>`).
			defaultCountry,
			countries,
			countryOptionsOrder,
			labels,
			flags,
			flagComponent,
			flagUrl,
			addInternationalOption,
			internationalIcon,
			// `displayInitialValueAsLocalNumber` property has been
			// superceded by `initialValueFormat` property.
			displayInitialValueAsLocalNumber,
			initialValueFormat,
			onCountryChange,
			limitMaxLength,
			countryCallingCodeEditable,
			focusInputOnCountrySelection,
			reset,
			metadata,
			international,
			locales,
			// compareStrings,
			...rest
		} = this.props

		const {
			country,
			phoneDigits,
			isFocused
		} = this.state

		const InputComponent = smartCaret ? InputSmart : InputBasic

		const countrySelectOptions = useMemoCountrySelectOptions(() => {
			return sortCountryOptions(
				getCountrySelectOptions({
					countries: countries || getCountries(metadata),
					countryNames: labels,
					addInternationalOption: (international && countryCallingCodeEditable === false) ? false : addInternationalOption,
					compareStringsLocales: locales,
					// compareStrings
				}),
				getSupportedCountryOptions(countryOptionsOrder, metadata)
			)
		}, [
			countries,
			countryOptionsOrder,
			addInternationalOption,
			labels,
			metadata
		])

		return (
			<ContainerComponent
				style={style}
				className={classNames(className, 'PhoneInput', {
					'PhoneInput--focus': isFocused
				})}>

				{/* Country `<select/>` */}
				<CountrySelectComponent
					name={name ? `${name}Country` : undefined}
					aria-label={labels.country}
					{...countrySelectProps}
					value={country}
					options={countrySelectOptions}
					onChange={this.onCountryChange}
					onFocus={this.onCountryFocus}
					onBlur={this.onCountryBlur}
					disabled={disabled || (countrySelectProps && countrySelectProps.disabled)}
					iconComponent={this.CountryIcon}/>

				{/* Phone number `<input/>` */}
				<InputComponent
					ref={this.getInputRef()}
					type="tel"
					autoComplete={autoComplete}
					{...numberInputProps}
					{...rest}
					name={name}
					metadata={metadata}
					country={country}
					value={phoneDigits || ''}
					onChange={this.onChange}
					onFocus={this.onFocus}
					onBlur={this.onBlur}
					disabled={disabled}
					inputComponent={inputComponent}
					className={classNames(
						'PhoneInputInput',
						numberInputProps && numberInputProps.className,
						rest.className
					)}/>
			</ContainerComponent>
		)
	}
}

// This wrapper is only to `.forwardRef()` to the `<input/>`.
const PhoneNumberInput = React.forwardRef((props, ref) => (
	<PhoneNumberInput_ {...props} inputRef={ref}/>
))

PhoneNumberInput.propTypes = {
	/**
	 * Phone number in `E.164` format.
	 *
	 * Example:
	 *
	 * `"+12223333333"`
	 */
	value: PropTypes.string,

	/**
	 * Updates the `value` as the user inputs the phone number.
	 */
	onChange: PropTypes.func.isRequired,

	/**
	 * Toggles the `--focus` CSS class.
	 * @ignore
	 */
	onFocus: PropTypes.func,

	/**
	 * `onBlur` is usually passed by `redux-form`.
	 * @ignore
	 */
	onBlur: PropTypes.func,

	/**
	 * `onKeyDown` handler (e.g. to handle Enter key press).
	 * @ignore
	 */
	onKeyDown: PropTypes.func,

	/**
	 * Set to `true` to disable both the phone number `<input/>`
	 * and the country `<select/>`.
	 */
	disabled: PropTypes.bool,

	/**
	 * Sets `autoComplete` property for phone number `<input/>`.
	 *
	 * Web browser's "autocomplete" feature
	 * remembers the phone number being input
	 * and can also autofill the `<input/>`
	 * with previously remembered phone numbers.
	 *
	 * https://developers.google.com
	 * /web/updates/2015/06/checkout-faster-with-autofill
	 *
	 * For example, can be used to turn it off:
	 *
	 * "So when should you use `autocomplete="off"`?
	 *  One example is when you've implemented your own version
	 *  of autocomplete for search. Another example is any form field
	 *  where users will input and submit different kinds of information
	 *  where it would not be useful to have the browser remember
	 *  what was submitted previously".
	 */
	// (is `"tel"` by default)
	autoComplete: PropTypes.string.isRequired,

	/**
	 * Set to `"national"` to show the initial `value` in
	 * "national" format rather than "international".
	 *
	 * For example, if `initialValueFormat` is `"national"`
	 * and the initial `value="+12133734253"` is passed
	 * then the `<input/>` value will be `"(213) 373-4253"`.
	 *
	 * By default, `initialValueFormat` is `undefined`,
	 * meaning that if the initial `value="+12133734253"` is passed
	 * then the `<input/>` value will be `"+1 213 373 4253"`.
	 *
	 * The reason for such default behaviour is that
	 * the newer generation grows up when there are no stationary phones
	 * and therefore everyone inputs phone numbers in international format
	 * in their smartphones so people gradually get more accustomed to
	 * writing phone numbers in international format rather than in local format.
	 * Future people won't be using "national" format, only "international".
	 */
	// (is `undefined` by default)
	initialValueFormat: PropTypes.oneOf(['national']),

	// `displayInitialValueAsLocalNumber` property has been
	// superceded by `initialValueFormat` property.
	displayInitialValueAsLocalNumber: PropTypes.bool,

	/**
	 * The country to be selected by default.
	 * For example, can be set after a GeoIP lookup.
	 *
	 * Example: `"US"`.
	 */
	// A two-letter country code ("ISO 3166-1 alpha-2").
	defaultCountry: PropTypes.string,

	/**
	 * If specified, only these countries will be available for selection.
	 *
	 * Example:
	 *
	 * `["RU", "UA", "KZ"]`
	 */
	countries: PropTypes.arrayOf(PropTypes.string),

	/**
	 * Custom country `<select/>` option names.
	 * Also some labels like "ext" and country `<select/>` `aria-label`.
	 *
	 * Example:
	 *
	 * `{ "ZZ": "Международный", RU: "Россия", US: "США", ... }`
	 *
	 * See the `locales` directory for examples.
	 */
	labels: labelsPropType.isRequired,

	/**
	 * Country `<select/>` options are sorted by their labels.
	 * The default sorting function uses `a.localeCompare(b, locales)`,
	 * and, if that's not available, falls back to simple `a > b` / `a < b`.
	 * Some languages, like Chinese, support multiple sorting variants
	 * (called "collations"), and the user might prefer one or another.
	 * Also, sometimes the Operating System language is not always
	 * the preferred language for a person using a website or an application,
	 * so there should be a way to specify custom locale.
	 * This `locales` property mimicks the `locales` argument of `Intl` constructors,
	 * and can be either a Unicode BCP 47 locale identifier or an array of such locale identifiers.
	 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl#locales_argument
	 */
	locales: PropTypes.oneOfType([
		PropTypes.string,
		PropTypes.arrayOf(PropTypes.string)
	]),

	/*
	 * Custom country `<select/>` options sorting function.
	 * The default one uses `a.localeCompare(b)`, and,
	 * if that's not available, falls back to simple `a > b`/`a < b`.
	 * There have been requests to add custom sorter for cases
	 * like Chinese language and "pinyin" (non-default) sorting order.
	 * https://stackoverflow.com/questions/22907288/chinese-sorting-by-pinyin-in-javascript-with-localecompare
	compareStrings: PropTypes.func,
	 */

	/**
	 * A URL template of a country flag, where
	 * "{XX}" is a two-letter country code in upper case,
	 * or where "{xx}" is a two-letter country code in lower case.
	 * By default it points to `country-flag-icons` gitlab pages website.
	 * I imagine someone might want to download those country flag icons
	 * and host them on their own servers instead
	 * (all flags are available in the `country-flag-icons` library).
	 * There's a catch though: new countries may be added in future,
	 * so when hosting country flag icons on your own server
	 * one should check the `CHANGELOG.md` every time before updating this library,
	 * otherwise there's a possibility that some new country flag would be missing.
	 */
	flagUrl: PropTypes.string.isRequired,

	/**
	 * Custom country flag icon components.
	 * These flags will be used instead of the default ones.
	 * The the "Flags" section of the readme for more info.
	 *
	 * The shape is an object where keys are country codes
	 * and values are flag icon components.
	 * Flag icon components receive the same properties
	 * as `flagComponent` (see below).
	 *
	 * Example:
	 *
	 * `{ "RU": (props) => <img src="..."/> }`
	 *
	 * Example:
	 *
	 * `import flags from 'country-flag-icons/react/3x2'`
	 *
	 * `import PhoneInput from 'react-phone-number-input'`
	 *
	 * `<PhoneInput flags={flags} .../>`
	 */
	flags: PropTypes.objectOf(PropTypes.elementType),

	/**
	 * Country flag icon component.
	 *
	 * Takes properties:
	 *
	 * * `country: string` — The country code.
	 * * `countryName: string` — The country name.
	 * * `flagUrl: string` — The `flagUrl` property (see above).
	 * * `flags: object` — The `flags` property (see above).
	 */
	flagComponent: PropTypes.elementType.isRequired,

	/**
	 * Set to `false` to remove the "International" option from country `<select/>`.
	 */
	addInternationalOption: PropTypes.bool.isRequired,

	/**
	 * "International" icon component.
	 * Should have the same aspect ratio.
	 *
	 * Receives properties:
	 *
	 * * `title: string` — "International" country option label.
	 */
	internationalIcon: PropTypes.elementType.isRequired,

	/**
	 * Can be used to place some countries on top of the list of country `<select/>` options.
	 *
	 * * `"XX"` — inserts an option for "XX" country.
	 * * `"🌐"` — inserts "International" option.
	 * * `"|"` — inserts a separator.
	 * * `"..."` — inserts options for the rest of the countries (can be omitted, in which case it will be automatically added at the end).
	 *
	 * Example:
	 *
	 * `["US", "CA", "AU", "|", "..."]`
	 */
	countryOptionsOrder: PropTypes.arrayOf(PropTypes.string),

	/**
	 * `<Phone/>` component CSS style object.
	 */
	style: PropTypes.object,

	/**
	 * `<Phone/>` component CSS class.
	 */
	className: PropTypes.string,

	/**
	 * Country `<select/>` component.
	 *
	 * Receives properties:
	 *
	 * * `name: string?` — HTML `name` attribute.
	 * * `value: string?` — The currently selected country code.
	 * * `onChange(value: string?)` — Updates the `value`.
	 * * `onFocus()` — Is used to toggle the `--focus` CSS class.
	 * * `onBlur()` — Is used to toggle the `--focus` CSS class.
	 * * `options: object[]` — The list of all selectable countries (including "International") each being an object of shape `{ value: string?, label: string }`.
	 * * `iconComponent: PropTypes.elementType` — React component that renders a country icon: `<Icon country={value}/>`. If `country` is `undefined` then it renders an "International" icon.
	 * * `disabled: boolean?` — HTML `disabled` attribute.
	 * * `tabIndex: (number|string)?` — HTML `tabIndex` attribute.
	 * * `className: string` — CSS class name.
	 */
	countrySelectComponent: PropTypes.elementType.isRequired,

	/**
	 * Country `<select/>` component props.
	 * Along with the usual DOM properties such as `aria-label` and `tabIndex`,
	 * some custom properties are supported, such as `arrowComponent` and `unicodeFlags`.
	 */
	countrySelectProps: PropTypes.object,

	/**
	 * Phone number `<input/>` component.
	 *
	 * Receives properties:
	 *
	 * * `value: string` — The formatted `value`.
	 * * `onChange(event: Event)` — Updates the formatted `value` from `event.target.value`.
	 * * `onFocus()` — Is used to toggle the `--focus` CSS class.
	 * * `onBlur()` — Is used to toggle the `--focus` CSS class.
	 * * Other properties like `type="tel"` or `autoComplete="tel"` that should be passed through to the DOM `<input/>`.
	 *
	 * Must also either use `React.forwardRef()` to "forward" `ref` to the `<input/>` or implement `.focus()` method.
	 */
	inputComponent: PropTypes.elementType.isRequired,

	/**
	 * Wrapping `<div/>` component.
	 *
	 * Receives properties:
	 *
	 * * `style: object` — A component CSS style object.
	 * * `className: string` — Classes to attach to the component, typically changes when component focuses or blurs.
	 */
	containerComponent: PropTypes.elementType.isRequired,

	/**
	 * Phone number `<input/>` component props.
	 */
	numberInputProps: PropTypes.object,

	/**
	 * By default, the caret position is being "intelligently" managed
	 * while a user inputs a phone number.
	 * This "smart" caret behavior can be turned off
	 * by passing `smartCaret={false}` property.
	 * This is just an "escape hatch" for any possible caret position issues.
	 */
	// Is `true` by default.
	smartCaret: PropTypes.bool.isRequired,

	/**
	 * Set to `true` to force "international" phone number format.
	 * Set to `false` to force "national" phone number format.
	 * By default it's `undefined` meaning that it doesn't enforce any phone number format.
	 */
	international: PropTypes.bool,

	/**
	 * If set to `true`, the phone number input will get trimmed
	 * if it exceeds the maximum length for the country.
	 */
	limitMaxLength: PropTypes.bool.isRequired,

	/**
	 * If set to `false`, and `international` is `true`, then
	 * users won't be able to erase the "country calling part"
	 * of a phone number in the `<input/>`.
	 */
	countryCallingCodeEditable: PropTypes.bool.isRequired,

	/**
	 * `libphonenumber-js` metadata.
	 *
	 * Can be used to pass custom `libphonenumber-js` metadata
	 * to reduce the overall bundle size for those who compile "custom" metadata.
	 */
	metadata: metadataPropType.isRequired,

	/**
	 * Is called every time the selected country changes:
	 * either programmatically or when user selects it manually from the list.
	 */
	// People have been asking for a way to get the selected country.
	// @see  https://github.com/catamphetamine/react-phone-number-input/issues/128
	// For some it's just a "business requirement".
	// I guess it's about gathering as much info on the user as a website can
	// without introducing any addional fields that would complicate the form
	// therefore reducing "conversion" (that's a marketing term).
	// Assuming that the phone number's country is the user's country
	// is not 100% correct but in most cases I guess it's valid.
	onCountryChange: PropTypes.func,

	/**
	 * If set to `false`, will not focus the `<input/>` component
	 * when the user selects a country from the list of countries.
	 * This can be used to conform to the Web Content Accessibility Guidelines (WCAG).
	 * Quote:
	 * "On input: Changing the setting of any user interface component
	 *  does not automatically cause a change of context unless the user
	 *  has been advised of the behaviour before using the component."
	 */
	focusInputOnCountrySelection: PropTypes.bool.isRequired
}

PhoneNumberInput.defaultProps = {
	/**
	 * Remember (and autofill) the value as a phone number.
	 */
	autoComplete: 'tel',

	/**
	 * Flag icon component.
	 */
	flagComponent: Flag,

	/**
	 * By default, uses icons from `country-flag-icons` gitlab pages website.
	 */
	// Must be equal to `flagUrl` in `./CountryIcon.js`.
	flagUrl: 'https://purecatamphetamine.github.io/country-flag-icons/3x2/{XX}.svg',

	/**
	 * Default "International" country `<select/>` option icon.
	 */
	internationalIcon: InternationalIcon,

	/**
	 * Phone number `<input/>` component.
	 */
	inputComponent: 'input',

	/**
	 * Wrapping `<div/>` component.
	 */
	containerComponent: 'div',

	/**
	 * Some users requested a way to reset the component:
	 * both number `<input/>` and country `<select/>`.
	 * Whenever `reset` property changes both number `<input/>`
	 * and country `<select/>` are reset.
	 * It's not implemented as some instance `.reset()` method
	 * because `ref` is forwarded to `<input/>`.
	 * It's also not replaced with just resetting `country` on
	 * external `value` reset, because a user could select a country
	 * and then not input any `value`, and so the selected country
	 * would be "stuck", if not using this `reset` property.
	 */
	// https://github.com/catamphetamine/react-phone-number-input/issues/300
	reset: PropTypes.any,

	/**
	 *
	 */

	/**
	 * Set to `false` to use "basic" caret instead of the "smart" one.
	 */
	smartCaret: true,

	/**
	 * Whether to add the "International" option
	 * to the list of countries.
	 */
	addInternationalOption: true,

	/**
	 * If set to `true` the phone number input will get trimmed
	 * if it exceeds the maximum length for the country.
	 */
	limitMaxLength: false,

	/**
	 * If set to `false`, and `international` is `true`, then
	 * users won't be able to erase the "country calling part"
	 * of a phone number in the `<input/>`.
	 */
	countryCallingCodeEditable: true,

	/**
	 * If set to `false`, will not focus the `<input/>` component
	 * when the user selects a country from the list of countries.
	 * This can be used to conform to the Web Content Accessibility Guidelines (WCAG).
	 * Quote:
	 * "On input: Changing the setting of any user interface component
	 *  does not automatically cause a change of context unless the user
	 *  has been advised of the behaviour before using the component."
	 */
	focusInputOnCountrySelection: true
}

export default PhoneNumberInput

let countrySelectOptionsMemo
let countrySelectOptionsMemoDependencies
function useMemoCountrySelectOptions(generator, dependencies) {
	if (!countrySelectOptionsMemoDependencies ||
		!areEqualArrays(dependencies, countrySelectOptionsMemoDependencies)) {
		countrySelectOptionsMemo = generator()
		countrySelectOptionsMemoDependencies = dependencies
	}
	return countrySelectOptionsMemo
}

function areEqualArrays(a, b) {
	if (a.length !== b.length) {
		return false
	}
	let i = 0
	while (i < a.length) {
		if (a[i] !== b[i]) {
			return false
		}
		i++
	}
	return true
}