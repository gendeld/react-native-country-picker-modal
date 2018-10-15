// @flow

import React, { Component } from 'react';
import PropTypes from 'prop-types';

import {
  StyleSheet,
  View,
  Image,
  TouchableOpacity,
  Modal,
  Text,
  TextInput,
  ListView,
  ScrollView,
  Platform
} from 'react-native';
import SafeAreaView from 'react-native-safe-area-view';

import Fuse from 'fuse.js';

import cca2List from '../data/cca2.json';
import { getHeightPercent } from './ratio';
import CloseButton from './CloseButton';
import countryPickerStyles from './CountryPicker.style';
import KeyboardAvoidingView from './KeyboardAvoidingView';

const countries = require('../data/countries.json');

let styles = {};

export const getAllCountries = () =>
  cca2List.map(cca2 => ({ ...countries[cca2], cca2 }));

const ds = new ListView.DataSource({ rowHasChanged: (r1, r2) => r1 !== r2 });

export default class CountryPicker extends Component {
  static propTypes = {
    isStatePicker: PropTypes.bool,
    cca2: PropTypes.string.isRequired,
    translation: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    onClose: PropTypes.func,
    closeable: PropTypes.bool,
    filterable: PropTypes.bool,
    children: PropTypes.node,
    countryList: PropTypes.array,
    excludeCountries: PropTypes.array,
    styles: PropTypes.object,
    filterPlaceholder: PropTypes.string,
    autoFocusFilter: PropTypes.bool,
    // to provide a functionality to disable/enable the onPress of Country Picker.
    disabled: PropTypes.bool,
    filterPlaceholderTextColor: PropTypes.string,
    closeButtonImage: PropTypes.element,
    transparent: PropTypes.bool,
    animationType: PropTypes.oneOf(['slide', 'fade', 'none'])
  };

  static defaultProps = {
    translation: 'eng',
    countryList: cca2List,
    excludeCountries: [],
    filterPlaceholder: 'Filter',
    autoFocusFilter: true,
    transparent: false,
    animationType: 'none'
  };

  static renderEmojiFlag(country, emojiStyle) {
    return (
      <Text style={[styles.emojiFlag, emojiStyle]}>
        {!!country ? <Emoji name={country.flag} /> : null}
      </Text>
    );
  }

  static renderImageFlag(country, imageStyle) {
    return !!country && !!country.flag ? (
      <Image
        style={[styles.imgStyle, imageStyle]}
        source={{ uri: country.flag }}
      />
    ) : null;
  }

  static renderFlag(country, itemStyle, emojiStyle, imageStyle) {
    return (
      <View style={[styles.itemCountryFlag, itemStyle]}>
        {CountryPicker.renderImageFlag(country, imageStyle)}
      </View>
    );
  }

  constructor(props) {
    super(props);
    this.openModal = this.openModal.bind(this);
    this.countries = null;
    this.Emoji = null;

    if (!!props.isStatePicker) {
      this.countries = require('../data/states.json');
      this.Emoji = <View />;
    } else {
      this.countries = require('../data/countries.json');
      this.Emoji = <View />;
    }
    // dimensions of country list and window
    let countryList = [...props.countryList];
    const excludeCountries = [...props.excludeCountries];

    excludeCountries.forEach(excludeCountry => {
      const index = countryList.indexOf(excludeCountry);

      if (index !== -1) {
        countryList.splice(index, 1);
      }
    });

    // Sort country list
    countryList = countryList
      .map(c => [c, this.getCountryName(this.countries[c])])
      .sort((a, b) => {
        if (a[1] < b[1]) return -1;
        if (a[1] > b[1]) return 1;
        return 0;
      })
      .map(c => c[0]);

    this.state = {
      modalVisible: false,
      cca2List: countryList,
      dataSource: ds.cloneWithRows(countryList),
      filter: '',
      letters: this.getLetters(countryList)
    };

    if (this.props.styles) {
      Object.keys(countryPickerStyles).forEach(key => {
        styles[key] = StyleSheet.flatten([
          countryPickerStyles[key],
          this.props.styles[key]
        ]);
      });
      styles = StyleSheet.create(styles);
    } else {
      styles = countryPickerStyles;
    }

    this.fuse = new Fuse(
      countryList.reduce(
        (acc, item) => [
          ...acc,
          { id: item, name: this.getCountryName(this.countries[item]) }
        ],
        []
      ),
      {
        shouldSort: true,
        threshold: 0.6,
        location: 0,
        distance: 100,
        maxPatternLength: 32,
        minMatchCharLength: 1,
        keys: ['name'],
        id: 'id'
      }
    );
  }

  componentWillMount() {
    this.itemHeight = getHeightPercent(7);
    this.listHeight = this.countries.length * this.itemHeight;
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.countryList !== this.props.countryList) {
      this.setState({
        cca2List: nextProps.countryList,
        dataSource: ds.cloneWithRows(nextProps.countryList)
      });
    }
  }

  onSelectCountry(cca2) {
    this.setState({
      modalVisible: false,
      filter: '',
      dataSource: ds.cloneWithRows(this.state.cca2List)
    });

    this.props.onChange({
      cca2,
      ...this.countries[cca2],
      flag: undefined,
      name: this.getCountryName(this.countries[cca2])
    });
  }

  onClose() {
    this.setState({
      modalVisible: false,
      filter: '',
      dataSource: ds.cloneWithRows(this.state.cca2List)
    });
    if (this.props.onClose) {
      this.props.onClose();
    }
  }

  getCountryName(country, optionalTranslation) {
    const translation = optionalTranslation || this.props.translation || 'eng';
    return country.name[translation] || country.name.common;
  }

  setVisibleListHeight(offset) {
    this.visibleListHeight = getHeightPercent(100) - offset;
  }

  getLetters(list) {
    return Object.keys(
      list.reduce(
        (acc, val) => ({
          ...acc,
          [this.getCountryName(this.countries[val])
            .slice(0, 1)
            .toUpperCase()]: ''
        }),
        {}
      )
    ).sort();
  }

  openModal = this.openModal.bind(this);

  openModal() {
    this.setState({ modalVisible: true });
  }

  scrollTo(letter) {
    // find position of first country that starts with letter
    const index = this.state.cca2List
      .map(country => this.getCountryName(this.countries[country])[0])
      .indexOf(letter);
    if (index === -1) {
      return;
    }
    let position = index * this.itemHeight;

    // do not scroll past the end of the list
    if (position + this.visibleListHeight > this.listHeight) {
      position = this.listHeight - this.visibleListHeight;
    }

    // scroll
    this._listView.scrollTo({
      y: position
    });
  }

  handleFilterChange = value => {
    const filteredCountries =
      value === '' ? this.state.cca2List : this.fuse.search(value);

    this._listView.scrollTo({ y: 0 });

    this.setState({
      filter: value,
      dataSource: ds.cloneWithRows(filteredCountries)
    });
  };

  renderCountry(country, index) {
    return (
      <TouchableOpacity
        key={index}
        onPress={() => this.onSelectCountry(country)}
        activeOpacity={0.99}
      >
        {this.renderCountryDetail(country)}
      </TouchableOpacity>
    );
  }

  renderLetters(letter, index) {
    return (
      <TouchableOpacity
        key={index}
        onPress={() => this.scrollTo(letter)}
        activeOpacity={0.6}
      >
        <View style={styles.letter}>
          <Text style={styles.letterText}>{letter}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  renderCountryDetail(cca2) {
    const country = this.countries[cca2];
    return (
      <View style={styles.itemCountry}>
        {!this.props.isStatePicker ? (
          CountryPicker.renderFlag(country)
        ) : (
          <View style={{ width: 30 }} />
        )}
        <View style={styles.itemCountryName}>
          <Text style={styles.countryName}>{this.getCountryName(country)}</Text>
        </View>
      </View>
    );
  }

  render() {
    return (
      <SafeAreaView>
        <View>
          <TouchableOpacity
            disabled={this.props.disabled}
            onPress={() => this.setState({ modalVisible: true })}
            activeOpacity={0.7}
          >
            {this.props.children ? (
              this.props.children
            ) : (
              <View style={[styles.touchFlag, { marginTop: 5 }]}>
                {CountryPicker.renderFlag(thic.countries[this.props.cca2])}
              </View>
            )}
          </TouchableOpacity>
          <Modal
            transparent={this.props.transparent}
            animationType={this.props.animationType}
            visible={this.state.modalVisible}
            onRequestClose={() => this.setState({ modalVisible: false })}
          >
            <View style={styles.modalContainer}>
              <View style={styles.header}>
                {this.props.closeable && (
                  <CloseButton
                    image={this.props.closeButtonImage}
                    styles={[styles.closeButton, styles.closeButtonImage]}
                    onPress={() => this.onClose()}
                  />
                )}
                {this.props.filterable && (
                  <TextInput
                    autoFocus={this.props.autoFocusFilter}
                    autoCorrect={false}
                    placeholder={this.props.filterPlaceholder}
                    placeholderTextColor={this.props.filterPlaceholderTextColor}
                    style={[
                      styles.input,
                      !this.props.closeable && styles.inputOnly
                    ]}
                    onChangeText={this.handleFilterChange}
                    value={this.state.filter}
                  />
                )}
              </View>
              <KeyboardAvoidingView behavior="padding">
                <View style={styles.contentContainer}>
                  <ListView
                    keyboardShouldPersistTaps="always"
                    enableEmptySections
                    ref={listView => (this._listView = listView)}
                    dataSource={this.state.dataSource}
                    renderRow={country => this.renderCountry(country)}
                    initialListSize={30}
                    pageSize={15}
                    onLayout={({
                      nativeEvent: {
                        layout: { y: offset }
                      }
                    }) => this.setVisibleListHeight(offset)}
                  />
                  <ScrollView
                    contentContainerStyle={styles.letters}
                    keyboardShouldPersistTaps="always"
                  >
                    {this.state.filter === '' &&
                      this.state.letters.map((letter, index) =>
                        this.renderLetters(letter, index)
                      )}
                  </ScrollView>
                </View>
              </KeyboardAvoidingView>
            </View>
          </Modal>
        </View>
      </SafeAreaView>
    );
  }
}
