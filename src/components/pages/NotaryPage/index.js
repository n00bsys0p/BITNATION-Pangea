/** @jsx React.DOM */
require('./style.scss');

var React = require('react');
var nameHelper = require('../../lib/nameHelper')('NotaryPage');
var bitnMixins = require('../../lib/bitnMixins');
var Search = require('../../controls/Search');
var Table = require('../../controls/Table');
var NotaryUpload = require('../../notary/NotaryUpload');
var NotaryTxVerifier = require('../../notary/NotaryTxVerifier');

var PageHeader = require('../../layout/PageHeader');
var PageRow = require('../../layout/PageRow');
var PageSection = require('../../layout/PageSection');
var Results = require('../../layout/Results');

var _ = require('lodash');

var Bitnation = require('../../../bitnation/bitnation.pangea');

var ui = new Bitnation.pangea.UI();

module.exports = React.createClass({
  displayName: nameHelper.displayName,
  mixins: bitnMixins,
  propTypes: {
    cursor: React.PropTypes.object.isRequired,
    notary: React.PropTypes.object.isRequired,
    dispatch: React.PropTypes.func.isRequired
  },
  getInitialState: function() {
    var user = ui.getCurrentUser();
    return {
      myAccountRS: user.accountRS,
      myDocuments: [],
      searchDocuments: []
    };
  },
  componentWillMount: function() {
    ui.getDocuments(this.state.myAccountRS)
      .done(this.onDocuments)
      .fail(this.onFail);
  },
  render: function() {
    var cursor = this.props.cursor;
    var notary = this.props.notary;
    var dispatch = this.props.dispatch;

    return (
      <div className={nameHelper.className}>
        <PageHeader title='Public Notary' />

        <div>
          <PageRow>
            <PageSection flex={3}>
              <NotaryUpload
                cursor={cursor.cursor('upload')}
                uploads={notary.get('uploads')}
                dispatch={dispatch} />
            </PageSection>

            <PageSection flex={1} title='Get started'>
              <NotaryTxVerifier
                cursor={cursor.cursor('txVerifier')}
                verified={notary.getIn(['tx', 'verified'])}
                dispatch={dispatch} />
            </PageSection>
          </PageRow>

          <PageRow>
            <PageSection flex={3}>
              <Results title='Your latest registered public documents'>
                <Table head={['Document digest', 'Timestamp']}
                  body={this.state.myDocuments} />
              </Results>
            </PageSection>

            <PageSection flex={1}>
              <img src='/images/logo.png' style={{
                display: 'block',
                width: '100%',
                WebkitFilter: 'invert(0.7)'
              }} />
            </PageSection>
          </PageRow>

          <PageRow>
            <PageSection flex={1} title="Find another user's public timestamps">
              <Search placeholder={'Horizon address'} onSubmit={this.onSearchSubmit} />

              <Results title='Search results'>
                <Table head={['Document digest', 'Timestamp']}
                  body={this.state.searchDocuments} />
              </Results>
            </PageSection>

            <PageSection flex={1} title='Template library'>
              <Search />

              <Results title='Search results'>
                <Table head={['Document digest (due @ beta)', 'Timestamp (due @ beta)']}
                  body={[ ]} />
              </Results>
            </PageSection>
          </PageRow>
        </div>
      </div>
    );
  },
  onDocuments: function (documents) {
    if (documents.length > 0) {

      var docTable = [];

      documents.forEach(function (item) {
        docTableRow = [];

        if (item.message.notary.uri !== undefined) {
          var uri = item.message.notary.uri;
          var protocol = uri.split(':')[0];

          // Add links to any notary docs that have a URI
          if (
              (protocol === 'http' || protocol === 'https' || protocol === 'ftp')
            &&
              (uri.split('.').length >= 2)
          ) {
            docTableRow.push(
              <a
                href={item.message.notary.uri}
                target={'_blank'}
              >{item.message.notary.hash}</a>
            );
          } else {
            docTableRow.push(item.message.notary.hash);
          }
        } else {
          docTableRow.push(item.message.notary.hash);
        }

        docTableRow.push(item.date.toUTCString());
        docTable.push(docTableRow);
      });

      this.setState({
        myDocuments: docTable
      });
    }
  },
  onFail: function (err) {
    console.error(err);
  },
  onSearchSubmit: function (accountRS) {
    var address = new Bitnation.horizon.Address(accountRS);

    if (!address.accountRS) {
      return alert('You need to enter a Horizon account ID.');
    }

    ui.getDocuments(address.accountRS)
      .done(this.onSearchSuccess)
      .fail(this.onFail);
  },
  onSearchSuccess: function (documents) {

    var tableDocs = [];

    if (documents.length > 0) {
      documents.forEach(function (doc) {
        var fullHash = doc.message.notary.hash;
        var firstHalf = fullHash.substring(0, parseInt(fullHash.length / 2));
        var secondHalf = fullHash.substring(parseInt(fullHash.length / 2), fullHash.length);

        var splitHalves = firstHalf + ' ' + secondHalf;
        tableDocs.push([splitHalves, doc.date.toUTCString()]);
      });
    }

    this.setState({
      searchDocuments: tableDocs
    });

  }
});
