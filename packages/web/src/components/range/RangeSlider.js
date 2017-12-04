import React, { Component } from "react";
import { connect } from "react-redux";
import {
	addComponent,
	removeComponent,
	watchComponent,
	updateQuery,
	setQueryOptions
} from "@appbaseio/reactivecore/lib/actions";
import {
	checkValueChange,
	checkPropChange
} from "@appbaseio/reactivecore/lib/utils/helper";
import types from "@appbaseio/reactivecore/lib/utils/types";
import Rheostat from "rheostat";

import HistogramContainer from "./addons/HistogramContainer";
import RangeLabel from "./addons/RangeLabel";
import Slider from "../../styles/Slider";
import Title from "../../styles/Title";
import { rangeLabelsContainer } from "../../styles/Label";

class RangeSlider extends Component {
	constructor(props) {
		super(props);

		this.state = {
			width: 0,
			currentValue: [props.range.start, props.range.end],
			stats: []
		};
		this.internalComponent = this.props.componentId + "__internal";
	}

	componentWillMount() {
		this.props.addComponent(this.props.componentId);
		this.props.addComponent(this.internalComponent);
		this.setReact(this.props);

		const queryOptions = {
			aggs: this.histogramQuery()
		};

		this.props.setQueryOptions(this.internalComponent, queryOptions);
		// Since the queryOptions are attached to the internal component,
		// we need to notify the subscriber (parent component)
		// that the query has changed because no new query will be
		// auto-generated for the internal component as its
		// dependency tree is empty
		this.props.updateQuery({
			componentId: this.internalComponent,
			value: null
		});

		if (this.props.selectedValue) {
			this.handleChange(this.props.selectedValue);
		} else if (this.props.defaultSelected) {
			this.handleChange([
				this.props.defaultSelected.start,
				this.props.defaultSelected.end
			]);
		}
	}

	componentWillReceiveProps(nextProps) {
		checkPropChange(this.props.react, nextProps.react, () =>
			this.setReact(nextProps)
		);
		checkPropChange(this.props.options, nextProps.options, () => {
			const { options } = nextProps;
			options.sort(function(a, b) {
				if (a.key < b.key) return -1;
				if (a.key > b.key) return 1;
				return 0;
			});
			this.setState({
				stats: options
			});
		});
		if (this.props.defaultSelected !== nextProps.defaultSelected) {
			this.handleChange(
				[nextProps.defaultSelected.start, nextProps.defaultSelected.end],
				nextProps
			);
		} else if (this.state.currentValue !== nextProps.selectedValue
			&& (nextProps.selectedValue || nextProps.selectedValue === null)) {
			this.handleChange(nextProps.selectedValue);
		}
	}

	shouldComponentUpdate(nextProps) {
		const upperLimit = Math.floor((nextProps.range.end - nextProps.range.start) / 2);
		if (nextProps.stepValue < 1 || nextProps.stepValue > upperLimit) {
			console.warn(`stepValue for RangeSlider ${nextProps.componentId} should be greater than 0 and less than or equal to ${upperLimit}`);
			return false;
		}
		return true;
	}

	componentWillUnmount() {
		this.props.removeComponent(this.props.componentId);
	}

	setReact = props => {
		const { react } = props;
		if (react) {
			const newReact = pushToAndClause(react, this.internalComponent);
			props.watchComponent(props.componentId, newReact);
		} else {
			props.watchComponent(props.componentId, { and: this.internalComponent });
		}
	};

	defaultQuery = (value, props) => {
		if (Array.isArray(value) && value.length) {
			return {
				range: {
					[props.dataField]: {
						gte: value[0],
						lte: value[1],
						boost: 2.0
					}
				}
			};
		}
		return null;
	};

	getSnapPoints = () => {
		let snapPoints = [];
		for (let i = this.props.range.start; i <= this.props.range.end; i += this.props.stepValue) {
			snapPoints = snapPoints.concat(i);
		}
		if (snapPoints[snapPoints.length - 1] !== this.props.range.end) {
			snapPoints = snapPoints.concat(this.props.range.end);
		}
		return snapPoints;
	};

	histogramQuery = () => {
		return {
			[this.props.dataField]: {
				histogram: {
					field: this.props.dataField,
					interval:
						this.props.interval ||
						Math.ceil((this.props.range.end - this.props.range.start) / 10)
				}
			}
		};
	};

	handleChange = (currentValue, props = this.props) => {
		const performUpdate = () => {
			this.setState({
				currentValue
			});
			this.updateQuery(currentValue, props);
		};
		checkValueChange(
			props.componentId,
			{
				start: currentValue[0],
				end: currentValue[1]
			},
			props.beforeValueChange,
			props.onValueChange,
			performUpdate
		);
	};

	handleSlider = ({ values }) => {
		this.handleChange(values);
	};

	updateQuery = (value, props) => {
		const query = props.customQuery || this.defaultQuery;
		let onQueryChange = null;
		if (props.onQueryChange) {
			onQueryChange = props.onQueryChange;
		}
		props.updateQuery({
			componentId: props.componentId,
			query: query(value, props),
			value,
			label: props.filterLabel,
			showFilter: false,	// disable filters for RangeSlider
			URLParams: props.URLParams,
			onQueryChange
		});
	};

	render() {
		return (
			<Slider primary>
				{this.props.title && <Title>{this.props.title}</Title>}
				{this.state.stats.length && this.props.showHistogram ? (
					<HistogramContainer
						stats={this.state.stats}
						range={this.props.range}
						interval={
							this.props.interval ||
							Math.ceil((this.props.range.end - this.props.range.start) / 10)
						}
					/>
				) : null}
				<Rheostat
					min={this.props.range.start}
					max={this.props.range.end}
					values={this.state.currentValue}
					onChange={this.handleSlider}
					snap
					snapPoints={this.getSnapPoints()}
				/>
				{
					this.props.rangeLabels &&
					<div className={rangeLabelsContainer}>
						<RangeLabel align="left">{this.props.rangeLabels.start}</RangeLabel>
						<RangeLabel align="right">{this.props.rangeLabels.end}</RangeLabel>
					</div>
				}
			</Slider>
		);
	}
}

RangeSlider.propTypes = {
	range: types.range,
	componentId: types.stringRequired,
	addComponent: types.funcRequired,
	setQueryOptions: types.funcRequired,
	updateQuery: types.funcRequired,
	defaultSelected: types.range,
	react: types.react,
	options: types.options,
	removeComponent: types.funcRequired,
	dataField: types.stringRequired,
	interval: types.number,
	beforeValueChange: types.func,
	onValueChange: types.func,
	customQuery: types.func,
	onQueryChange: types.func,
	showHistogram: types.bool,
	stepValue: types.number,
	URLParams: types.boolRequired,
	title: types.title,
	filterLabel: types.string,
	rangeLabels: types.rangeLabels,
	selectedValue: types.selectedValue
};

RangeSlider.defaultProps = {
	range: {
		start: 0,
		end: 10
	},
	stepValue: 1,
	showHistogram: true,
	URLParams: false
};

const mapStateToProps = (state, props) => ({
	options: state.aggregations[props.componentId]
		? state.aggregations[props.componentId][props.dataField].buckets
		: [],
	selectedValue: state.selectedValues[props.componentId] ? state.selectedValues[props.componentId].value : [
		props.range.start,
		props.range.end
	]
});

const mapDispatchtoProps = dispatch => ({
	addComponent: component => dispatch(addComponent(component)),
	removeComponent: component => dispatch(removeComponent(component)),
	watchComponent: (component, react) =>
		dispatch(watchComponent(component, react)),
	updateQuery: updateQueryObject => dispatch(updateQuery(updateQueryObject)),
	setQueryOptions: (component, props, onQueryChange) =>
		dispatch(setQueryOptions(component, props, onQueryChange))
});

export default connect(mapStateToProps, mapDispatchtoProps)(RangeSlider);